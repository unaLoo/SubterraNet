//////// 3rd party
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
mapboxgl.accessToken = "pk.eyJ1IjoieWNzb2t1IiwiYSI6ImNrenozdWdodDAza3EzY3BtdHh4cm5pangifQ.ZigfygDi2bK4HXY1pWh-wg";

/////// local
import TubeLayerGroup from "./TubeLayer";
import ConduitLayer from "./subLayers/ConduitLayer";
import OutfallLayer from "./subLayers/OutfallLayer";
import JunctionLayer from "./subLayers/JunctionLayer";
import PenerateLayer from "./subLayers/PenetrateLayer";

/////// data
import conduitJson from "../assets/0312/conduit.json";
import outfallJson from "../assets/0110/outfall.json";
import junctionJson from "../assets/0312/junction.json";

export const start = () => {
    let map = new mapboxgl.Map({
        container: "map",
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [114.050488236074003, 22.458682681330203],
        zoom: 17,
        projection: "mercator",
    });
    map.once("load", () => {

        map.on('click', e => {
            console.log(e.lngLat)
        })

        ////////////////// 1st tube layer //////////////////
        /////// under ground layer group
        const tubeLayerGroup = new TubeLayerGroup(
            "tube_layer",
            [114.058113056174633, 22.44979484375407]
        );
        // const conduitLayer = new ConduitLayer("conduit_layer", {
        //     line_geojson: conduitJson,
        //     order: 1,
        //     onInitialized: () => {
        //         // 2nd
        //         const junctionLayer = new OutfallLayer("junction_layer", {
        //             point_geojson: junctionJson,
        //             order: 2
        //         });
        //         tubeLayerGroup.addSubLayer(junctionLayer);

        //         // 3rd
        //         const outfallLayer = new OutfallLayer("outfall_layer", {
        //             point_geojson: outfallJson,
        //             order: 3,
        //         });
        //         tubeLayerGroup.addSubLayer(outfallLayer);

        //         // 4th
        //         const penetrateLayer = new PenerateLayer("penetrate_layer", {});
        //         tubeLayerGroup.addSubLayer(penetrateLayer);
        //     },
        // });


        map.addLayer(tubeLayerGroup);

        const junctionLayer = new OutfallLayer("junction_layer", {
            point_geojson: junctionJson,
            order: 2
        });
        tubeLayerGroup.addSubLayer(junctionLayer);

    });
};
