import { lnglat2MyWorld, calcMatrix } from "../lib/LargeWorld"
import * as GLib from '../lib/glLib'
import showCode from './shaders/show.glsl?raw'

export default class TubeLayerGroup {
    /**
     * @param {string} id 
     */
    constructor(id, originLngLat) {

        // base
        this.id = id || "tube-layer"
        this.type = "custom"

        this.map = null
        this.gl = null
        this.origin = lnglat2MyWorld(originLngLat)

        // state
        this.subLayers = []
        this.prepared = false

    }

    addSubLayer(subLayer) {
        console.log("add sublayer", subLayer.id)
        // logic
        if (this.subLayers.find(_subLayer => _subLayer.id === subLayer.id)) {
            console.warn(`sublayer with id ${subLayer.id} already exist`)
            return
        }
        this.subLayers.push(subLayer)

        // if map setted , initialize
        if (this.map && this.gl) {
            subLayer.initialize(this.map, this.gl, this)
            this.map.triggerRepaint()
        } else {
            console.log(`add sublayer ${subLayer.id} info: map or gl not ready`)
        }
    }

    removeSubLayer(id) {
        console.log("remove sublayer", id);

        // logic
        let targetSubLayer = this.subLayers.find(subLayer => subLayer.id === id);
        if (!targetSubLayer) {
            console.warn(`sublayer with id ${id} not exist`);
            return;
        }
        targetSubLayer.remove();
        this.subLayers = this.subLayers.filter(subLayer => subLayer.id !== id);

        // render
        this.map && this.map.triggerRepaint()
    }

    showLayer(id) {
        // logic
        const subLayer = this.subLayers.find(subLayer => subLayer.id === id)
        subLayer.show()

        // render
        this.map && this.map.triggerRepaint()

    }

    hideLayer(id) {
        // logic
        const subLayer = this.subLayers.find(subLayer => subLayer.id === id)
        subLayer.hide()

        // render
        this.map && this.map.triggerRepaint()
    }


    /**
     * @param {mapboxgl.Map} map 
     * @param {WebGL2RenderingContext} mapbox_gl 
     */
    async onAdd(map, mapbox_gl) {
        this.map = map
        const gl = this.gl = mapbox_gl

        // gen a fbo
        this.layerTexture = GLib.createTexture2D(gl, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE)
        this.depthRBO = GLib.createRenderBufferD24S8(gl, gl.canvas.width, gl.canvas.height)
        this.layerFbo = GLib.createFrameBuffer(gl, [this.layerTexture], null, this.depthRBO)

        this.showProgram = GLib.createShaderFromCode(gl, showCode)
        this.textureLocation = gl.getUniformLocation(this.showProgram, "debugTexture")
        this.maskLocation = gl.getUniformLocation(this.showProgram, "maskTexture")

        // const bitmap = await GLib.loadImage("/images/concrete.jpg")
        // this.ttex = GLib.createTexture2D(gl, bitmap.width, bitmap.height, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)

        // if add subLayer after onAdd
        for (let i = 0; i < this.subLayers.length; i++) {
            if (!this.subLayers[i].initialized) this.subLayers[i].initialize(this.map, this.gl, this)
        }

    }
    /**
       * 
       * @param {WebGL2RenderingContext} mapbox_gl 
       */
    render(mapbox_gl, mapbox_u_matrix) {

        const gl = this.gl
        const map = this.map
        this.matrix = calcMatrix(this.map.transform.clone(), this.origin).elements

        //////////////TICK LOGIC
        if (!this.maskTexture) return

        //////////////RENDER
        // sorted again?
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerFbo)
        gl.clearColor(0.0, 0.0, 0.0, 0.0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)

        this.subLayers.forEach(subLayer => {
            if (subLayer.initialized) {
                subLayer.render(this.gl, this.matrix)
            }
        })

        gl.flush()

        gl.useProgram(this.showProgram)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.layerTexture)
        gl.uniform1i(this.textureLocation, 0)

        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.maskTexture)
        gl.uniform1i(this.maskLocation, 1)


        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

        this.map.triggerRepaint()

    }

    onRemove() {

        console.log(this.id + " removed! (^_^)");

    }

}