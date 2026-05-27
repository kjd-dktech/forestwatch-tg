# -----------------------------------------------------------------------------
# Copyright (c) 2025-2026 DKTech Innovations.
# Licensed under the CC-BY-NC-4.0 License. See LICENSE file in the project root.
#
# Project: ForestWatch Togo - Land Cover & Deforestation AI Monitor
# Maintainer: Kodjo Jean DEGBEVI (@kjd-dktech)
# -----------------------------------------------------------------------------

import os, sys, base64, json, tempfile, io, logging, ee, uuid, mercantile, mapbox_vector_tile, h3
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Security, Depends, Request, Response
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
import pandas as pd
import numpy as np
from shapely.geometry import Point
import geopandas as gpd
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()
GEE_PROJECT_NAME = os.getenv("GEE_PROJECT_NAME", "forestwatch-tg")
API_KEY = os.getenv("API_KEY", "not_set")
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "50"))

CURRENT_FILE_DIR = Path(__file__).resolve().parent
REPO_ROOT = CURRENT_FILE_DIR.parent.parent

if str(REPO_ROOT) not in sys.path:
    sys.path.append(str(REPO_ROOT))

from backend.logging.logging_config import setup_logger
logger = setup_logger("api", "main", "api.log")

from backend.api.middleware import RequestIDMiddleware

try:
    from backend.core.predictor import LandCoverPredictor
    from src.gee_memory import extract_point_features
    predictor = LandCoverPredictor()
    EXPECTED_FEATURES = predictor.expected_features.tolist()

except Exception as e:
    logger.error(f"❌ Erreur d'import : {e}")
    predictor = None
    extract_point_features = None
    EXPECTED_FEATURES = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🎬 Initialisation de Google Earth Engine...")
    app.state.gee_ready = False
    app.state.jobs = {} # Stockage mémoire des prédictions
    try:
        # Connexion via Service Account
        service_account = os.getenv("GEE_SERVICE_ACCOUNT")
        temp_dir = os.getenv("GEE_KEY_FILE_DIR", "/tmp")
        os.makedirs(temp_dir, exist_ok=True)
        key_b64 = os.getenv("GEE_KEY_FILE_B64", "")
        if service_account and key_b64 :
            logger.info("🔐 Utilisation du Service Account pour GEE...")
            with tempfile.NamedTemporaryFile(mode="wb", suffix=".json", dir=temp_dir, delete=True) as tmp:
                tmp.write(base64.b64decode(key_b64))
                tmp.flush()
                credentials = ee.ServiceAccountCredentials(service_account, tmp.name)
                ee.Initialize(credentials=credentials, project=GEE_PROJECT_NAME)
            del key_b64
            app.state.gee_ready = True
        
        # Connexion via token GEE (doit avoir été déjà configuré)
        else:
            logger.info("💻 Utilisation du token GEE local (mode développeur)...")
            ee.Initialize(project=GEE_PROJECT_NAME)
            app.state.gee_ready = True
        
        if app.state.gee_ready : logger.info(f"✅ GEE Initialisé (avec le projet {GEE_PROJECT_NAME})")
    except Exception as e:
        logger.error(f"❌ Impossible d'initialiser GEE : {e}")

    yield
    logger.info("🛑 Arrêt de l'API")

app = FastAPI(
    title="ForestWatch Togo API",
    description="API de prédiction de classification d'occupation des sols et déforestation",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(RequestIDMiddleware)

origins = [
    "http://localhost:3000",
    "https://symmetrical-umbrella-x5p9xw5qw7j7cv7gp-3000.app.github.dev/",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)

def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        logger.warning(f"Tentative de prédiction avec une clé API invalide.")
        raise HTTPException(status_code=403, detail="Accès refusé : Clé API invalide.")
    return api_key


@app.get("/")
def read_root(request: Request):
    return {
        "status": "online", 
        "message": "Bienvenue sur l'API ForestWatch Togo",
        "model_loaded": predictor is not None,
        "gee_ready": getattr(request.app.state, "gee_ready", False)
    }

@app.post("/predict/file/")
async def predict_file(request: Request, file: UploadFile = File(...), api_key: str = Depends(verify_api_key)):
    """
    Endpoint acceptant un fichier CSV, JSON, GeoJSON ou Excel (xlsx, xls).
    Retourne les prédictions d'occupation des sols.
    """
    logger.info(f"Fichier reçu : {file.filename}")
    
    max_file_size = MAX_FILE_SIZE_MB * 1024 * 1024
    
    if file.size and file.size > max_file_size:
        logger.warning(f"Rejet: Fichier trop volumineux ({file.size} bytes). Limite: {max_file_size} bytes.")
        raise HTTPException(status_code=413, detail=f"Payload Too Large: Le fichier dépasse la limite de {MAX_FILE_SIZE_MB} MB autorisée.")

    if not predictor:
        logger.error("Requête de prédiction mais modèle non chargé.")
        raise HTTPException(status_code=503, detail="Modèle IA non chargé sur le serveur.")

    try:
        contents = await file.read()
        
        if len(contents) > max_file_size:
            logger.warning(f"Rejet post-lecture: Fichier trop volumineux ({len(contents)} bytes).")
            raise HTTPException(status_code=413, detail="Payload Too Large: Le fichier d'entrée dépasse la limite autorisée.")
            
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        elif file.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(contents))
        elif file.filename.endswith(('.json', '.geojson')):
            data_json = json.loads(contents.decode('utf-8'))
            score_features = 'features' in data_json
            if score_features:
                properties_list = [feat.get('properties', {}) for feat in data_json['features']]
                df = pd.DataFrame(properties_list)
            else:
                df = pd.DataFrame(data_json)
        else:
            logger.warning(f"Format non supporté: {file.filename}")
            raise ValueError("Le fichier doit être au format .csv, .xls, .xlsx, .json ou .geojson")
            
        logger.info(f"Données extraites : {df.shape[0]} lignes pour l'inférence.")
        
        results_df = predictor.predict(df)
        
        results_df = results_df.replace({pd.NA: None, np.nan: None})
        
        columns_to_return = []
        if 'latitude' in results_df.columns:
            columns_to_return.append('latitude')
        if 'longitude' in results_df.columns:
            columns_to_return.append('longitude')
            
        columns_to_return.extend(['prediction_label', 'confidence_score'])
        
        # Enregistrement du job
        job_id = str(uuid.uuid4())
        filtered_df = results_df[columns_to_return].copy()
        
        # On s'assure que latitude/longitude est bien présent pour le MVT
        is_mappable = 'latitude' in filtered_df.columns and 'longitude' in filtered_df.columns
        if is_mappable:
            # Conversion vers GeoDataFrame pour mapbox/mercantile
            geometry = [Point(xy) for xy in zip(filtered_df.longitude, filtered_df.latitude)]
            gdf = gpd.GeoDataFrame(filtered_df, geometry=geometry, crs="EPSG:4326")
            request.app.state.jobs[job_id] = gdf
        else:
            # Stockage pour SWR n'ayant pas de layers MVT/H3
            request.app.state.jobs[job_id] = filtered_df
            
        json_results = filtered_df.to_dict(orient="records")
        
        logger.info(f"✅ Prédiction réussie pour {file.filename}. Job ID: {job_id}")
        return {
            "job_id": job_id,
            "filename": file.filename,
            "rows_processed": len(results_df),
            "is_mappable": is_mappable,
            "predictions": json_results
        }
        
    except ValueError as ve:
        logger.error(f"❌ Erreur de validation des données : {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"❌ Erreur inattendue : {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur lors de la prédiction : {str(e)}")


@app.post("/predict/pixel/")
def predict_pixel(request: Request, data: Dict[str, Any] = Body(...), api_key: str = Depends(verify_api_key)):
    """
    Endpoint acceptant un objet JSON représentant un seul point (pixel) Sentinel-2.
    """
    logger.info("Requête unitaire reçue pour un pixel.")
    if not predictor:
        raise HTTPException(status_code=503, detail="Modèle IA non chargé sur le serveur.")
        
    try:
        if not data:
             raise ValueError("Le corps de la requête JSON est vide.")
             
        # Si la requête contient uniquement les coordonnées, on déclenche l'extraction GEE
        is_coord_only = len(data) <= 4 and 'latitude' in data and 'longitude' in data
        
        if is_coord_only:
            if not getattr(request.app.state, "gee_ready", False):
                logger.error("Tentative d'extraction spatiale mais Google Earth Engine n'est pas initialisé.")
                raise HTTPException(status_code=503, detail="Le service Google Earth Engine n'est pas disponible. Impossible d'extraire les signaux satellitaires.")
                
            lat = data['latitude']
            lng = data['longitude']
            year = data.get('year', '2025')
            
            logger.info(f"Interrogation de Google Earth Engine pour le pixel [{lat}, {lng}]...")
            try:
                gee_data = extract_point_features(lat, lng, year)
                if gee_data is None:
                    raise ValueError("Aucune donnée satellitaire S2 disponible pour ce point (nuages persistants, océan profond ou hors-zone).")
                
                # Fusionner les features GEE extraites dans l'objet "data" principal
                data.update(gee_data)
                logger.info(f"Features GEE extraites : {len(gee_data.keys())} propriétés spatio-temporelles.")
            except Exception as gee_err:
                logger.error(f"Erreur d'extraction de GEE : {gee_err}", exc_info=True)
                raise HTTPException(status_code=502, detail=f"Échec de l'extraction des signaux spatiaux (Google Earth Engine) : {str(gee_err)}")
             
        df_pixel = pd.DataFrame([data])
        results_df = predictor.predict(df_pixel)

        
        result_dict = {
            "prediction_label": results_df.iloc[0]['prediction_label'],
            "confidence_score": float(results_df.iloc[0]['confidence_score'])
        }
        
        if 'latitude' in df_pixel.columns and pd.notnull(df_pixel.iloc[0]['latitude']):
            result_dict['latitude'] = results_df.iloc[0]['latitude']
        if 'longitude' in df_pixel.columns and pd.notnull(df_pixel.iloc[0]['longitude']):
            result_dict['longitude'] = results_df.iloc[0]['longitude']
            
        logger.info(f"✅ Prédiction réussie : {result_dict['prediction_label']} ({result_dict['confidence_score']})")
        return result_dict

    except ValueError as ve:
        logger.warning(f"Erreur validation pixel : {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"❌ Erreur inattendue pixel : {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur interne : {str(e)}")

@app.get("/predict/tile/{job_id}/{z}/{x}/{y}.pbf")
async def get_mvt_tile(request: Request, job_id: str, z: int, x: int, y: int):
    """
    Endpoint vector tile (MVT) pour un rendu massif.
    """
    jobs = getattr(request.app.state, "jobs", {})
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job ID introuvable ou expiré.")
    
    gdf = jobs[job_id]
    
    bounds = mercantile.bounds(x, y, z)
    subset = gdf.cx[bounds.west:bounds.east, bounds.south:bounds.north]
    
    if subset.empty:
        return Response(content=b"", media_type="application/vnd.mapbox-vector-tile")
        
    features = []
    for _, row in subset.iterrows():
        feat = {
            "geometry": row.geometry.wkt,
            "properties": {
                "prediction_label": row.get("prediction_label", ""),
                "confidence_score": float(row.get("confidence_score", 0.0))
            }
        }
        features.append(feat)
        
    layer = [{
        "name": "predictions",
        "features": features
    }]
    
    try:
        pbf_content = mapbox_vector_tile.encode(
            layer,
            default_options={"quantize_bounds": (bounds.west, bounds.south, bounds.east, bounds.north)}
        )
        return Response(content=pbf_content, media_type="application/vnd.mapbox-vector-tile")
    except Exception as e:
        logger.error(f"Erreur d'encodage de la tile: {e}")
        return Response(content=b"", media_type="application/vnd.mapbox-vector-tile")

@app.get("/predict/h3/{job_id}")
async def get_h3_aggregation(request: Request, job_id: str, resolution: int = 8):
    """
    Renvoie les données agrégées via H3 (Uber Hexagons).
    """
    jobs = getattr(request.app.state, "jobs", {})
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job ID introuvable ou expiré.")
        
    gdf = jobs[job_id]

    def get_h3(row):
        try:
            return h3.latlng_to_cell(row.geometry.y, row.geometry.x, resolution)
        except:
            return None
            
    gdf['h3_index'] = gdf.apply(get_h3, axis=1)
    
    # Aggregation: mode & mean confidence
    agg_df = gdf.groupby('h3_index').agg(
        count=('h3_index', 'size'),
        prediction_label=('prediction_label', lambda x: x.mode().iloc[0] if not x.mode().empty else ""),
        confidence_score=('confidence_score', 'mean')
    ).reset_index()
    
    results = agg_df.to_dict(orient="records")
    return {"resolution": resolution, "hexagons": results}


@app.get("/predict/job/{job_id}")
async def get_job_results(request: Request, job_id: str):
    """
    Endpoint pour SWR : permet au frontend de récupérer les points bruts d'un job_id après rechargement.
    """
    jobs = getattr(request.app.state, "jobs", {})
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job ID introuvable ou expiré en mémoire cache du serveur.")
        
    df = jobs[job_id]
    
    # Check si c'est un GeoDataFrame pour extraire les colonnes (SWR aura besoin des mêmes infos)
    results = []
    if isinstance(df, gpd.GeoDataFrame):
        for _, row in df.iterrows():
            feat = {
                "prediction_label": row.get("prediction_label", ""),
                "confidence_score": float(row.get("confidence_score", 0.0)),
                "longitude": row.geometry.x,
                "latitude": row.geometry.y
            }
            results.append(feat)
        is_mappable = True
    else:
        results = df.to_dict(orient="records")
        is_mappable = False
        
    return {
        "job_id": job_id,
        "is_mappable": is_mappable,
        "predictions": results
    }
