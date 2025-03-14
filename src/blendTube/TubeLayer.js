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
        this.subLayers.sort((a, b) => a.order - b.order)
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

        GLib.enableAllExtensions(gl)

        // gen a fbo
        this.layerTexture = GLib.createTexture2D(gl, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE)
        // this.depthTexture = GLib.createTexture2D(gl, gl.canvas.width, gl.canvas.height, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT)
        // this.depthRenderBuffer = GLib.createRenderBufferD24S8(gl, gl.canvas.width, gl.canvas.height)
        // this.depthRenderBuffer = GLib.createRenderBuffer(gl, gl.canvas.width, gl.canvas.height)
        // this.layerFbo = GLib.createFrameBuffer(gl, [this.layerTexture], null, null)
        this.customDepthTexture = GLib.createTexture2D(gl, gl.canvas.width, gl.canvas.height, gl.R32F, gl.RED, gl.FLOAT)

        this.depthBuffer = gl.createRenderbuffer()
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer)
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, gl.canvas.width, gl.canvas.height)
        gl.bindRenderbuffer(gl.RENDERBUFFER, null)

        this.layerFbo = gl.createFramebuffer()
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerFbo)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.layerTexture, 0)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.customDepthTexture, 0)
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthBuffer)

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        console.log(gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE)

        this.showProgram = GLib.createShaderFromCode(gl, showCode)
        this.textureLocation = gl.getUniformLocation(this.showProgram, "debugTexture")
        this.maskLocation = gl.getUniformLocation(this.showProgram, "maskTexture")

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
        // if (!this.maskTexture) return

        //////////////RENDER
        // Pass [0] : Clear the color-attachment and depth-buffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerFbo)
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

        gl.enable(gl.DEPTH_TEST)
        gl.depthMask(true)
        gl.clearDepth(1.0)
        gl.clear(gl.DEPTH_BUFFER_BIT)

        gl.clearColor(0.0, 0.0, 0.0, 0.0)
        gl.drawBuffers([gl.COLOR_ATTACHMENT0 | gl.COLOR_ATTACHMENT1])
        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.clearColor(0.3, 1.0, 1.0, 0.5)
        gl.drawBuffers([gl.COLOR_ATTACHMENT1])
        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])

        // gl.disable(gl.DEPTH_TEST)
        // gl.clearColor(0.0, 0.0, 0.0, 0.0)
        // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)

        // Pass [n]: Clear the color-attachment and depth-buffer
        this.subLayers.forEach(subLayer => {
            if (subLayer.initialized) {
                subLayer.render(this.gl, this.matrix)
            }
        })

        // Pass [ending]: Clear the color-attachment and depth-buffer
        gl.useProgram(this.showProgram)
        gl.activeTexture(gl.TEXTURE0)
        // gl.bindTexture(gl.TEXTURE_2D, this.layerTexture)
        gl.bindTexture(gl.TEXTURE_2D, this.customDepthTexture)
        // gl.bindTexture(gl.TEXTURE_2D, this.depthTexture)
        gl.uniform1i(this.textureLocation, 0)

        // gl.activeTexture(gl.TEXTURE1)
        // gl.bindTexture(gl.TEXTURE_2D, this.maskTexture)
        // gl.uniform1i(this.maskLocation, 1)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

        // this.map.triggerRepaint()

    }

    onRemove() {

        console.log(this.id + " removed! (^_^)");

    }

}