import * as THREE from 'three'
import * as util from '../../lib/glLib'
import shaderCode from '../shaders/Junction.glsl?raw'
import { mat4 } from 'gl-matrix';
import { lnglat2MyWorld } from '../../lib/LargeWorld';

export default class JunctionLayer {

    /**
     * @param {string} id layer id
     * @param {Object} options.point_geojson geojson point data
     * @param {number} options.minZoom
     * @param {number} options.maxZoom
     * @param {number} options.order
     */
    constructor(id, options) {
        // base
        this.id = id;
        this.type = "custom";
        this.geotype = "point"

        // config
        this.geojson = options.point_geojson
        this.minZoom = options.minZoom || 10
        this.maxZoom = options.maxZoom || 20
        this.order = options.order || 999

        // state
        this.initialized = false
        this.visible = true

    }

    show() {
        this.visible = true
    }
    hide() {
        this.visible = false
    }

    /**
     * @param {mapboxgl.Map} map 
     * @param {WebGL2RenderingContext} _gl
     */
    async initialize(map, _gl, layerGroup) {
        console.log(this.id, " initializing")
        this.map = map
        const gl = this.gl = _gl
        this.layerGroup = layerGroup

        ////////////// shader and program
        this.program = util.createShaderFromCode(gl, shaderCode)

        ////////////// data and buffer
        const cylinderData = generateOneBall(0.01)
        const { vertices } = generateOneBall(0.01 * 110)//exaggerated vertex for scale

        const points = generatePoints(this.geojson, this.layerGroup.origin)

        this.posBuffer = util.createVBO(gl, points)
        this.instanceNum = points.length / 3
        this.vertBuffer = util.createVBO(gl, cylinderData.vertices)
        this.BIGvertBuffer = util.createVBO(gl, vertices)
        this.normBuffer = util.createVBO(gl, cylinderData.normals)
        this.uvBuffer = util.createVBO(gl, cylinderData.uvs)
        this.idxBuffer = util.createIBO(gl, cylinderData.indices)
        this.idxNum = cylinderData.indices.length
        this.idxType = gl.UNSIGNED_SHORT



        ////////////// vao 
        const pitVao = this.pitVao = gl.createVertexArray()
        gl.bindVertexArray(pitVao)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuffer)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 3 * 4, 0)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.normBuffer)
        gl.enableVertexAttribArray(1)
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 3 * 4, 0)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer)
        gl.enableVertexAttribArray(2)
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 2 * 4, 0)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer)
        gl.enableVertexAttribArray(3)
        gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 3 * 4, 0)
        gl.vertexAttribDivisor(3, 1)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.BIGvertBuffer)
        gl.enableVertexAttribArray(4)
        gl.vertexAttribPointer(4, 3, gl.FLOAT, false, 3 * 4, 0)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuffer)
        gl.bindVertexArray(null)

        this.initialized = true
        console.log(this.id, " initialized!")
    }
    /**
       * 
       * @param {WebGL2RenderingContext} _gl
       * @param {number[]} Xmatrix
       */
    render(_gl, Xmatrix) {
        if (!this.visible || this.map.transform.zoom < this.minZoom) return

        if (!this.initialized) {
            this.map.triggerRepaint()
            return
        }

        const gl = this.gl
        const map = this.map
        const program = this.program

        //////////////TICK LOGIC
        const u_modelMatrix = mat4.create()
        mat4.rotateX(u_modelMatrix, u_modelMatrix, Math.PI / 2)

        const scaleRate = (map.transform.zoom - this.minZoom) / (this.maxZoom - this.minZoom)

        //////////////RENDER

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerGroup.layerFbo)
        // gl.depthMask(true)
        // gl.enable(gl.DEPTH_TEST)
        // gl.depthFunc(gl.LESS)
        gl.useProgram(program)
        gl.bindVertexArray(this.pitVao)

        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_matrix'), false, Xmatrix)
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_modelMatrix'), false, u_modelMatrix)
        gl.uniform1f(gl.getUniformLocation(program, 'scaleRate'), scaleRate)
        gl.drawElementsInstanced(gl.TRIANGLES, this.idxNum, this.idxType, 0, this.instanceNum)

        gl.bindVertexArray(null)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }

    remove() {



        console.log(this.id + " removed! (^_^)");

    }

}

/////////// Helpers

function generateOneBall(radius = 0.01) {
    const geometry = new THREE.SphereGeometry(radius, 16, 16);
    return {
        vertices: geometry.attributes.position.array,
        normals: geometry.attributes.normal.array,
        uvs: geometry.attributes.uv.array,
        indices: geometry.index.array, // Uint16Array
    }
}


function generatePoints(geojson, refPos) {
    const defaultHeight = -0.4
    const points = new Float32Array(geojson.features.length * 2)
    for (let i = 0; i < geojson.features.length; i++) {
        const feature = geojson.features[i];
        const lnglat = feature.geometry.coordinates
        const posinMyWorld = lnglat2MyWorld(lnglat)
        points[i * 3 + 0] = posinMyWorld[0] - refPos[0]
        points[i * 3 + 1] = posinMyWorld[1] - refPos[1]
        points[i * 3 + 2] = defaultHeight
    }
    return points
}