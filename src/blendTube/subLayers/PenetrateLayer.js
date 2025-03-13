import * as GLib from '../../lib/glLib'
import MapboxDraw from "@mapbox/mapbox-gl-draw"
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import { lnglat2MyWorld } from '../../lib/LargeWorld';
import earcut from 'earcut'


const tubeViewPolygon = {
    "id": "VfEPBGjQYherJ2XE5NXaE4EHI9Ouky2x",
    "type": "Feature",
    "properties": {},
    "geometry": {
        "coordinates": [
            [
                [113, 22],
                [115, 22],
                [115, 24],
                [113, 24],
                [113, 22]
            ]
        ],
        "type": "Polygon"
    }
}



export default class PenerateLayer {

    constructor(id, options) {
        this.id = id || "penetrate-layer";
        this.type = "custom";

        this.maxPoint = options.maxPoint || 25

        // state
        this.initialized = false
        this.visible = true
    }

    set polygon(value) {
        if (value) {
            const { vertexData, indexData } = parse(value, this.layerGroup.origin)
            const idxNum = indexData.length
            this.vertexInfo = { vertexData, indexData, idxNum }
        }
    }

    show() {
        this.visible = true
    }
    hide() {
        this.visible = false
    }


    shaderCode() {
        return `
          #ifdef VERTEX_SHADER
          layout(location = 0) in vec2 i_pos;//lnglat
          uniform mat4 u_matrix;
  

          void main() {
              vec2 posinWS = i_pos;
              vec4 posinCS = u_matrix * vec4(posinWS, 0.0, 1.0);
              gl_Position = posinCS;
          }
          #endif
  
          #ifdef FRAGMENT_SHADER
          precision highp float;
          out float maskFlag; 
          void main() {
              maskFlag = 1.0;
          }
  
          #endif
      `
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

        // this.mapboxDraw = new MapboxDraw({
        //     displayControlsDefault: false,
        //     controls: {
        //         polygon: true,
        //         trash: true
        //     }
        // })
        // this.map.addControl(this.mapboxDraw, 'top-left')
        // console.log('111')

        // map.on('draw.create', (e) => {
        //     this.mapboxDraw.deleteAll()
        //     const polygonFeature = e.features[0]
        //     console.log(polygonFeature)
        //     this.update(polygonFeature)
        // })

        this.vertexInfo = {
            vertexData: [],
            indexData: [],
            idxNum: 0
        }

        this.maskTexture = GLib.createTexture2D(gl, gl.canvas.width, gl.canvas.height, gl.R8, gl.RED, gl.UNSIGNED_BYTE)
        this.maskFbo = GLib.createFrameBuffer(gl, [this.maskTexture], null, null)

        this.layerGroup.maskTexture = this.maskTexture

        this.program = GLib.createShaderFromCode(gl, this.shaderCode())
        this.matrixLoc = gl.getUniformLocation(this.program, "u_matrix")

        gl.useProgram(this.program)
        this.vbo = GLib.createVBO(gl, new Float32Array(this.maxPoint * 2).fill(0))//预留25个点的空间
        this.ibo = GLib.createIBO(gl, new Uint16Array(this.maxPoint).fill(0))//预留25个点的空间

        this.vao = gl.createVertexArray()
        gl.bindVertexArray(this.vao)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(this.vertexInfo.vertexData))
        gl.enableVertexAttribArray(gl.getAttribLocation(this.program, "i_pos"))
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo)
        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, new Uint16Array(this.vertexInfo.indexData))
        gl.bindVertexArray(null)

        console.log(this.id, " initialized!")
        this.update(tubeViewPolygon)

        this.initialized = true
    }
    /**
       * 
       * @param {WebGL2RenderingContext} _gl
       * @param {number[]} Xmatrix
       */
    render(_gl, Xmatrix) {
        const gl = this.gl


        gl.bindFramebuffer(gl.FRAMEBUFFER, this.maskFbo)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.useProgram(this.program)
        gl.bindVertexArray(this.vao)
        gl.uniformMatrix4fv(this.matrixLoc, false, Xmatrix)
        gl.drawElements(gl.TRIANGLES, this.vertexInfo.idxNum, gl.UNSIGNED_SHORT, 0)

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    }

    update(geofeature) {
        this.polygon = geofeature
        let gl = this.gl
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(this.vertexInfo.vertexData))
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo)
        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, new Uint16Array(this.vertexInfo.indexData))
        this.map.triggerRepaint()
    }

    remove() {

        this.mapboxDraw.deleteAll()
        this.map.removeControl(this.mapboxDraw)

        console.log(this.id + " removed! (^_^)");

    }

}


/////////// Helpers
function parse(feature, originInMyWorld) {

    let coordinate = feature.geometry.coordinates
    var data = earcut.flatten(coordinate)
    var triangle = earcut(data.vertices, data.holes, data.dimensions)
    coordinate = data.vertices.flat()

    for (let i = 0; i < coordinate.length; i += 2) {
        const lnglat = [coordinate[i], coordinate[i + 1]]
        const myWorld = lnglat2MyWorld(lnglat)
        coordinate[i] = myWorld[0] - originInMyWorld[0]
        coordinate[i + 1] = myWorld[1] - originInMyWorld[1]
    }
    console.log(coordinate)
    return {
        vertexData: coordinate,
        indexData: triangle,
    }
}