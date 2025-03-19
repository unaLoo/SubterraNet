import './style.css'
import mapboxgl from 'mapbox-gl'
import "mapbox-gl/dist/mapbox-gl.css";
mapboxgl.accessToken = "pk.eyJ1IjoieWNzb2t1IiwiYSI6ImNrenozdWdodDAza3EzY3BtdHh4cm5pangifQ.ZigfygDi2bK4HXY1pWh-wg";


import { start } from './blendTube/enter'
// start()

import { initMap } from './terrain/pureScratchMap';

initMap()