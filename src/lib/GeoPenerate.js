import earcut from 'earcut'


class PenerateLayer {

    constructor(geofeature) {
        this.id = "penetrate-layer";
        this.type = "custom";
        this.polygon = geofeature
        this.maxPoint = 25
    }

    set polygon(value) {
        if (value) {
            const { vertexData, indexData } = parse(value)
            const idxNum = indexData.length
            this.vertexInfo = { vertexData, indexData, idxNum }
        }
    }

    shaderCode() {
        return `
          #define PI 3.141592653589793
          #define RAD_TO_DEG 180.0 / PI
          #define DEG_TO_RAD PI / 180.0
      
          #ifdef VERTEX_SHADER
          layout(location = 0) in vec2 i_pos;//lnglat
          uniform mat4 u_matrix;
  
          //////// functions ///////////
          float mercatorXfromLng(float lng) {
              return (180.0 + lng) / 360.0;
          }
          float mercatorYfromLat(float lat) {
              return (180.0 - (RAD_TO_DEG * log(tan(PI / 4.0 + lat / 2.0 * DEG_TO_RAD)))) / 360.0;
          }
          void main() {
              vec2 posinWS = vec2(mercatorXfromLng(i_pos.x), mercatorYfromLat(i_pos.y));
              vec4 posinCS = u_matrix * vec4(posinWS, 0.0, 1.0);
              gl_Position = posinCS;
          }
          #endif
  
          #ifdef FRAGMENT_SHADER
          precision highp float;
          out vec4 outColor; 
          void main() {
              outColor = vec4(0.0,0.0,0.0,0.0);
          }
  
          #endif
      `
    }

    /**
     * 
     * @param {mapboxgl.Map} map 
     * @param {WebGL2RenderingContext} gl 
     */
    async onAdd(map, gl) {

        this.map = map
        this.gl = gl
        this.program = util.createShaderFromCode(gl, this.shaderCode())
        this.matrixLoc = gl.getUniformLocation(this.program, "u_matrix")
        gl.useProgram(this.program)
        this.vbo = util.createVBO(gl, new Float32Array(this.maxPoint * 2).fill(0))//预留25个点的空间
        this.ibo = util.createIBO(gl, new Uint16Array(this.maxPoint).fill(0))//预留25个点的空间

        this.vao = gl.createVertexArray()
        gl.bindVertexArray(this.vao)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(this.vertexInfo.vertexData))
        gl.enableVertexAttribArray(gl.getAttribLocation(this.program, "i_pos"))
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo)
        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, new Uint16Array(this.vertexInfo.indexData))
        gl.bindVertexArray(null)

    }
    /**
       * 
       * @param {WebGL2RenderingContext} gl 
       */
    render(gl, matrix) {
        tubeRender()
        gl.useProgram(this.program)
        gl.disable(gl.BLEND)
        gl.bindVertexArray(this.vao)
        gl.uniformMatrix4fv(this.matrixLoc, false, matrix)
        // gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        gl.drawElements(gl.TRIANGLES, this.vertexInfo.idxNum, gl.UNSIGNED_SHORT, 0)
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
}

function parse(feature) {

    let coordinate = feature.geometry.coordinates
    var data = earcut.flatten(coordinate)
    var triangle = earcut(data.vertices, data.holes, data.dimensions)
    coordinate = data.vertices.flat()
    return {
        vertexData: coordinate,
        indexData: triangle,
    }
}