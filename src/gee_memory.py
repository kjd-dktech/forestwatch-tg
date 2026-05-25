# -----------------------------------------------------------------------------
# Copyright (c) 2025-2026 DKTech Innovations.
# Licensed under the CC-BY-NC-4.0 License. See LICENSE file in the project root.
#
# Project: ForestWatch Togo - Land Cover & Deforestation AI Monitor
# Maintainer: Kodjo Jean DEGBEVI (@kjd-dktech)
# -----------------------------------------------------------------------------

import ee

PROJECT_ID = 'forestwatch-tg'

def get_togo_aoi():
    """Retourne la géométrie du Togo détaillée via LSIB"""
    return ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017").filter(ee.Filter.eq('country_na', 'Togo'))

def mask_s2_clouds_scl(image):
    scl = image.select('SCL')
    mask = scl.remap([3, 8, 9, 10], [0, 0, 0, 0], 1)
    return image.updateMask(mask).divide(10000)

def get_s2_composite(aoi, year='2025'):
    """Retourne l'image médiane composite Sentinel-2 pour l'année donnée"""
    return ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED") \
        .filterBounds(aoi.geometry()) \
        .filterDate(f'{year}-01-01', f'{year}-12-31') \
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) \
        .map(mask_s2_clouds_scl) \
        .median() \
        .clip(aoi.geometry())

def extract_point_features(lat: float, lng: float, year: str = '2025') -> dict:
    """
    Extrait les features (bandes brutes, indices spectraux, métriques statistiques et GLCM) 
    d'un point précis via une requête Google Earth Engine ponctuelle.
    """
    point = ee.Geometry.Point([lng, lat])
    
    # 1. Filtre spatio-temporel de base S2 SR Harmonized
    s2_col = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED") \
             .filterBounds(point) \
             .filterDate(f'{year}-01-01', f'{year}-12-31') \
             .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
             
    image = s2_col.map(mask_s2_clouds_scl).median()
    
    # 2. Calcul des indices spectraux
    ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
    ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI')
    ndbi = image.normalizedDifference(['B11', 'B8']).rename('NDBI')
    
    image_with_indices = image.addBands([ndvi, ndwi, ndbi])
    
    # 3. Variance spatiale (Fenêtre 3x3) pour extraire B4_var
    kernel = ee.Kernel.square(radius=1)
    variance = image_with_indices.select(['B4']).reduceNeighborhood(
        reducer=ee.Reducer.variance(), kernel=kernel
    ).rename(['B4_var'])
    
    image_with_stats = image_with_indices.addBands(variance)
    
    # 4. Préparation GLCM
    selected_bands_glcm = ['NDVI', 'NDWI', 'NDBI', 'B8', 'B12']
    
    # Fonction de re-scaling locale qui s'assurera un mapping valide en byte pour glcmTexture
    def rescale_to_byte(img, band_name, min_val, max_val):
        return img.select(band_name).subtract(min_val).divide(max_val - min_val).clamp(0, 1).multiply(255).toByte().rename(band_name)
    
    rescaled_bands = []
    for band in selected_bands_glcm:
        if band in ['NDVI', 'NDWI', 'NDBI']:
            rescaled_bands.append(rescale_to_byte(image_with_stats, band, -1, 1))
        else:
            rescaled_bands.append(rescale_to_byte(image_with_stats, band, 0, 0.5))

    rescaled_image = ee.Image(rescaled_bands)
    glcm_texture = rescaled_image.glcmTexture()
    
    # 5. Filtrage strict des 18 features attendues
    features_attendues = [
        'B12', 'B12_contrast', 'B12_diss', 
        'B4', 'B4_var', 
        'B8', 'B8_asm', 'B8_contrast', 'B8_diss', 
        'NDBI', 'NDBI_contrast', 'NDBI_diss', 
        'NDVI', 'NDVI_contrast', 'NDVI_diss', 
        'NDWI', 'NDWI_contrast', 'NDWI_diss'
    ]
    
    final_img = image_with_stats.addBands(glcm_texture).select(features_attendues)
    
    # 6. Échantillonnage à la localisation exacte (Scale = 10m résolution Sentinel)
    sampled_feature = final_img.sample(region=point, scale=10, numPixels=1, geometries=False).first()
    
    if not sampled_feature:
        return None # Masqué par les nuages tout au long de l'année ou hors couverture
        
    extracted_data = sampled_feature.getInfo()
    
    # On extrait les properties qui contiennent les pixels GEE
    final_properties = extracted_data.get('properties', {})
    
    if final_properties:
        final_properties['latitude'] = lat
        final_properties['longitude'] = lng
        
    return final_properties