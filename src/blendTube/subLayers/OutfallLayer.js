import * as THREE from 'three'
import * as util from '../../lib/glLib'
import shaderCode from '../shaders/Catchpit.glsl?raw'
import { mat4, vec3, vec4 } from 'gl-matrix';
import { lnglat2MyWorld } from '../../lib/LargeWorld';

export default class OutfallLayer {

    /**
     * @param {string} id layer id
     * @param {Object} options.point_geojson geojson point data
     * @param {number} options.minZoom
     * @param {number} options.maxZoom
     * @param {number} options.order
     */
    constructor(id, options) {
        // base
        this.id = id || "catchpit-layer";
        this.type = "custom";
        this.geotype = "point"

        // config
        this.geojson = options.point_geojson
        this.minZoom = options.minZoom || 10
        this.maxZoom = options.maxZoom || 20

        // state
        this.initialized = false
        this.visible = true
        this.order = options.order || 999

        // time
        this.currTime = 0
        this.deltaTime = 100

        // data
        this.numTimes = 24
        this.currTimeIdx = 0
        this.nextTimeIdx = 1
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
        const cylinderData = generateOneCylinder(0.01 * 2, 0.2 + 0.01)
        const { vertices } = generateOneCylinder(0.01 * 220, 0.2 + 0.01)//exaggerated vertex for scale

        const pointNum = this.geojson.features.length
        let vertexCount = 0
        const waterHeightArrayBuffers = this.waterHeightArrayBuffers = []

        for (let i = 0; i < this.numTimes; i++) {
            waterHeightArrayBuffers.push(new Float32Array(pointNum * 1))
        }
        for (let feature of this.geojson.features) {
            for (let i = 1; i <= this.numTimes; i++) {
                const currWH = Number(feature.properties["node_data_WH_" + i * 5])

                waterHeightArrayBuffers[i - 1].fill(currWH, vertexCount, vertexCount + 1) // currWH
            }
            vertexCount += 1
        }

        const points = generatePoints(this.geojson, this.layerGroup.origin)

        // debug
        this.pointA = [points[5 * 3], points[5 * 3 + 1], points[5 * 3 + 2], 1]
        this.pointB = [points[10 * 3], points[10 * 3 + 1], points[10 * 3 + 2], 1]
        this.pointC = [points[33 * 3], points[33 * 3 + 1], points[33 * 3 + 2], 1]

        this.posBuffer = util.createVBO(gl, points)
        this.instanceNum = points.length / 3
        this.vertBuffer = util.createVBO(gl, cylinderData.vertices)
        this.BIGvertBuffer = util.createVBO(gl, vertices)
        this.normBuffer = util.createVBO(gl, cylinderData.normals)
        this.uvBuffer = util.createVBO(gl, cylinderData.uvs)
        this.idxBuffer = util.createIBO(gl, cylinderData.indices)
        this.whBuffers = []
        for (let i = 0; i < this.numTimes; i++) {
            this.whBuffers.push(util.createVBO(gl, waterHeightArrayBuffers[i]))
        }
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

        gl.bindBuffer(gl.ARRAY_BUFFER, this.whBuffers[this.currTimeIdx])
        gl.enableVertexAttribArray(5)
        gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 1 * 4, 0)
        gl.vertexAttribDivisor(5, 1)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.whBuffers[this.nextTimeIdx])
        gl.enableVertexAttribArray(6)
        gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 1 * 4, 0)
        gl.vertexAttribDivisor(6, 1)

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

        // debug
        console.log("pointA:", this.pointA, "pointB:", this.pointB, "matrix", Xmatrix)
        const debug = (p, lb) => {
            let res = vec4.transformMat4(vec4.create(), p, Xmatrix)
            vec4.scale(res, res, 1 / res[3])
            console.log("lb: ", [res[0], res[1], res[2]])
        }
        debug(this.pointA, "a")
        debug(this.pointB, "b")
        debug(this.pointC, "c")



        const gl = this.gl
        const map = this.map
        const program = this.program

        //////////////TICK LOGIC
        const u_modelMatrix = mat4.create()
        mat4.rotateX(u_modelMatrix, u_modelMatrix, Math.PI / 2)


        const scaleRate = (map.transform.zoom - this.minZoom) / (this.maxZoom - this.minZoom)

        this.currTime++
        if (this.currTime % this.deltaTime == 0) {
            this.currTimeIdx = Math.min(this.currTimeIdx + 1, this.numTimes - 1)
            this.nextTimeIdx = Math.min(this.nextTimeIdx + 1, this.numTimes - 1)

            gl.bindVertexArray(this.pitVao)

            gl.bindBuffer(gl.ARRAY_BUFFER, this.whBuffers[this.currTimeIdx])
            gl.enableVertexAttribArray(5)
            gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 1 * 4, 0)
            gl.vertexAttribDivisor(5, 1)

            gl.bindBuffer(gl.ARRAY_BUFFER, this.whBuffers[this.nextTimeIdx])
            gl.enableVertexAttribArray(6)
            gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 1 * 4, 0)
            gl.vertexAttribDivisor(6, 1)

            gl.bindVertexArray(null)
        }

        //////////////RENDER
        // gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerGroup.layerFbo)

        // Pass [0] : Clear the color-attachment and depth-buffer
        // gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        // gl.depthMask(true)
        // gl.clearDepth(1.0)
        // gl.clearColor(0.0, 0.0, 0.0, 0.0)
        // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        gl.enable(gl.DEPTH_TEST)
        gl.depthFunc(gl.LESS)
        gl.enable(gl.CULL_FACE)
        gl.cullFace(gl.BACK)
        gl.useProgram(program)
        gl.bindVertexArray(this.pitVao)
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_matrix'), false, Xmatrix)
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_modelMatrix'), false, u_modelMatrix)
        gl.uniform1f(gl.getUniformLocation(program, 'scaleRate'), scaleRate)
        gl.uniform1f(gl.getUniformLocation(program, 'timeStep'), this.currTime / this.deltaTime * 1.0)

        // gl.drawElements(gl.TRIANGLES, this.tubeIdxNum, this.tubeIdxType, 0)
        gl.drawElementsInstanced(gl.TRIANGLES, this.idxNum, this.idxType, 0, this.instanceNum)

        gl.bindVertexArray(null)
        // gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, null)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }

    remove() {
        console.log(this.id + " removed! (^_^)");
    }

}

/////////// Helpers

function generateOneCylinder(radius = 0.01, height = 0.2) {
    // radius , height in MY_WORLD space
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
    return {
        vertices: geometry.attributes.position.array,
        normals: geometry.attributes.normal.array,
        uvs: geometry.attributes.uv.array,
        indices: geometry.index.array, // Uint16Array
    }
}

function generatePoints(geojson, refPos) {
    const defaultHeight = -0.2
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