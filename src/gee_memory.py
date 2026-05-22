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