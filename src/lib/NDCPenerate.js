export default class PenerateLayer {

    constructor(bboxinNDC, onUpdate) {
        this.id = "penetrate-layer";
        this.type = "custom";
        this.bbox = bboxinNDC //[left,bottom,right,top]
        this.onUpdate = onUpdate
    }

    set bbox(value) {
        if (value) {
            const [left, bottom, right, top] = value
            this.vertexData = [
                left, top,
                left, bottom,
                right, top,
                right, bottom
            ]
        } else {
            throw "invalid bbox"
        }
    }
    get bbox() {
        return this.vertexData
    }

    shaderCode() {
        return `

          #ifdef VERTEX_SHADER
          layout(location = 0) in vec2 i_pos;// NDC input
  
          void main() {
              vec4 posinCS = vec4(i_pos, 0.0, 1.0);
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
        this.program = createShaderFromCode(gl, this.shaderCode())

        this.vbo = createVBO(gl, this.bbox)

        this.vao = gl.createVertexArray()
        gl.bindVertexArray(this.vao)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
        gl.bindVertexArray(null)

    }
    /**
       * 
       * @param {WebGL2RenderingContext} gl 
       */
    render(gl, matrix) {
        this.onUpdate && this.onUpdate()

        // const isBlendingEnabled = gl.isEnabled(gl.BLEND)
        // const blendSrcRgb = gl.getParameter(gl.BLEND_SRC_RGB)
        // const blendDstRgb = gl.getParameter(gl.BLEND_DST_RGB)
        // const blendSrcAlpha = gl.getParameter(gl.BLEND_SRC_ALPHA)
        // const blendDstAlpha = gl.getParameter(gl.BLEND_DST_ALPHA)

        // if (!isBlendingEnabled) gl.enable(gl.BLEND)

        // gl.blendFunc(gl.MULT, gl.SRC_COLOR)

        gl.useProgram(this.program)
        gl.disable(gl.BLEND)
        // gl.enable(gl.BLEND)
        gl.bindVertexArray(this.vao)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

        // gl.blendFuncSeparate(blendSrcRgb, blendDstRgb, blendSrcAlpha, blendDstAlpha)

        // if (!isBlendingEnabled) gl.disable(gl.BLEND)
    }

    update(bboxinNDC) {
        this.bbox = bboxinNDC
        let gl = this.gl
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.bbox), gl.STATIC_DRAW)
        this.map.triggerRepaint()
    }
}
function createShaderFromCode(gl, code) {

    let shaderCode = code
    const vertexShaderStage = compileShader(gl, shaderCode, gl.VERTEX_SHADER)
    const fragmentShaderStage = compileShader(gl, shaderCode, gl.FRAGMENT_SHADER)

    const shader = gl.createProgram()
    gl.attachShader(shader, vertexShaderStage)
    gl.attachShader(shader, fragmentShaderStage)
    gl.linkProgram(shader)
    if (!gl.getProgramParameter(shader, gl.LINK_STATUS)) {

        console.error('An error occurred linking shader stages: ' + gl.getProgramInfoLog(shader))
    }

    return shader

    function compileShader(gl, source, type) {

        const versionDefinition = '#version 300 es\n'
        const module = gl.createShader(type)
        if (type === gl.VERTEX_SHADER) source = versionDefinition + '#define VERTEX_SHADER\n' + source
        else if (type === gl.FRAGMENT_SHADER) source = versionDefinition + '#define FRAGMENT_SHADER\n' + source

        gl.shaderSource(module, source)
        gl.compileShader(module)
        if (!gl.getShaderParameter(module, gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shader module: ' + gl.getShaderInfoLog(module))
            gl.deleteShader(module)
            return null
        }

        return module
    }
}
function createVBO(gl, data) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (data instanceof Array)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    else
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
}