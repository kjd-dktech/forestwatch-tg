# 🌳 ForestWatch Togo : Land Cover & Deforestation AI Monitor

Un système d'intelligence artificielle analysant les images satellites multispectrales (Sentinel-2) via Google Earth Engine pour classifier l'occupation des sols et surveiller l'évolution du couvert forestier au Togo. Pensez de l'extraction des données (Data Engineering) jusqu'au déploiement du modèle (AI Engineering), en passant par l'analyse géospatiale (Data Analysis).

**Dataset constitué** : [Lien vers Google Drive](https://drive.google.com/file/d/1q_eiRnCmQ5TSvsFPq1zPfdpX3ipYQkkC/view?usp=sharing)

---

## Objectif du projet
Fournir un outil robuste et automatisable permettant de détecter les différentes classes d'occupations des sols, avec un focus majeur sur la télédétection forestière (détection de la déforestation et des fronts agricoles).

## État de l'art du projet (Phases accomplies)

### 1. Data Collection & Engineering (Google Earth Engine)
- Extraction de données satellitaires **Sentinel-2 Level-2A** sur des coordonnées précises au Togo.
- Calcul de **37 features géospatiales et radiométriques** pour 21 000 pixels (sans données manquantes) comprenant :
  - **Bandes brutes** (Visible, NIR, SWIR).
  - **Indices spectraux** (NDVI, NDWI, NDBI, etc.) adaptés à la végétation, l'eau et l'urbain.
  - **Textures GLCM** (Variance, Contraste, ASM, Entropie) pour cartographier la complexité structurelle des paysages.

### 2. Modélisation et Optimisation (Machine Learning)
L'algorithme choisi est le **Random Forest**, idéal pour son interprétabilité radiométrique et sa robustesse. Tout le processus (Processing, Tuning) est documenté dans notre `modeling.ipynb` :
- **Ingénierie des caractéristiques** : Suppression des variables ultra-corrélées mathématiquement (Moyennes, Variances, Entropie) au profit de leurs paires structurales (Valeurs Brutes, Contraste, ASM).
- **Adaptation au "Plafond radiométrique"** : Fusion stratégique des classes ambigües ("Buissons" et "Savanes") en une classe "Végétation Mixte" (passage de 7 à 6 classes pour s'adapter à la limite de la résolution à 10 m).
- **Optimisation** : GridSearchCV avec optimisation de la métrique `F1-macro` pour rééquilibrer numériquement le modèle et forcer la détection optimale de la signature "Forêt" face à une classe floristique majoritaire écrasante.

### Performances du Modèle Final
Le modèle optimal obtenu assure le meilleur équilibre Précision/Rappel pour notre cible métier stricte (les forêts).
- **Exactitude Globale (Accuracy)** : ~76.2%
- **F1-Macro** : 0.77
- **Classe "Forêt"** : Précision 0.77 / Rappel 0.69 / F1-score 0.72

---

## Structure du Répertoire
- `data/` : Contient le jeu de données .csv initial et les sets de test/entraînement transformés et sauvegardés.
- `notebooks/` :
  - `data_collection.ipynb` : Logique d'extraction via GEE.
  - `collection_processing.ipynb` : Traitement de la collecte et création du dataset.
  - `modeling.ipynb` : EDA complet, nettoyage, entraînement, tuning et sauvegarde du modèle.
- `models/` : Contient le pipeline persistant (`scaler.joblib` et notre pipeline classifieur final `rfc_optimized_6classes.joblib`).
- `src/` : (À venir) Scripts finaux pour le passage en production.

## 🔜 Prochaines étapes
* **Industrialisation (Production)** : Encapsuler l'inférence dans un pipeline Python propre (`src/`).
* Création d'un module/API de prédiction capable de recevoir de nouvelles données Sentinel-2 et de générer une carte prédictive de couverture des sols.