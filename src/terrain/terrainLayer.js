import axios from 'axios'
import { BoundingBox2D, boundingBox2D } from './boundingBox2D'
import { plane } from './plane'
import { Node2D } from './node2D'
import { GUI } from 'dat.gui'

export default class TerrainLayer {

    constructor(maxLevel) {

        // Layer
        this.type = 'custom'
        this.map = undefined
        this.id = 'TerrainLayer'
        this.renderingMode = '3d'

        this.asLine = false
        this.nodeCount = 0
        this.maxLevel = maxLevel
        this.maxNodeCount = 1000

        this.sectorSize = 32
        this.sectorRange = [ 0.0, 0.0 ]
        this.exaggeration = 50.0
        this.tileBox = boundingBox2D()
        this.lodMapSize = [ 512, 512 ]
        this.visibleNodeLevel = [ 0, this.maxLevel ]
        this.elevationRange = [ -80.06899999999999, 4.3745 ]
        this.boundaryCondition = boundingBox2D(
            120.0437360613468201,
            31.17390195220948710,
            121.9662324011692220,
            32.08401085804678130,
        )
        this.nodeLevelArray = new Uint32Array(this.maxNodeCount)
        this.nodeBoxArray = new Float32Array(this.maxNodeCount * 4)


        this.interval = 1.0
        this.color = [0.0, 0.0, 0.0]

        this.indexNum = 0
    }

    onAdd(map, gl) {

        this.map = map

        const { positions, indices } = plane(Math.log2(this.sectorSize))
        this.positionArray = new Float32Array(positions)
        this.indexNum = indices.length

        this.indexTextureSize = Math.ceil(Math.sqrt(indices.length))
        this.positionTextureSize = Math.ceil(Math.sqrt(positions.length / 2))

        this.indexTextureArray = new Uint32Array(this.indexTextureSize * this.indexTextureSize)
        indices.forEach((value, index) => {
            this.indexTextureArray[index] = value
        })

        this.positionTextureArray = new Float32Array(this.positionTextureSize * this.positionTextureSize * 2)
        positions.forEach((value, index) => {
            this.positionTextureArray[index] = value
        })

        // dat.GUI
        const gui = new GUI()
        const contourFolder = gui.addFolder('Contour')
        contourFolder.add(this, 'interval', 0.1, 20.0).onChange(() => this.map.triggerRepaint())
        contourFolder.addColor(this, 'color').onChange(() => this.map.triggerRepaint())
        contourFolder.open()
        const terrainFolder = gui.addFolder('Terrain')
        terrainFolder.add(this, 'asLine', false).onChange(() => this.map.triggerRepaint())
        terrainFolder.add(this, 'exaggeration', 1.0, 100.0).onChange(() => this.map.triggerRepaint())
        terrainFolder.add(this, 'maxLevel', 14.0, 20.0, 1.0).onChange(() => this.map.triggerRepaint())
        terrainFolder.open()
        gui.hide()

        // Initialize layer passes
        this.init(gl)
    }

    /** @param { WebGL2RenderingContext } gl */
    async init(gl) {

        this.isInitialized = false

        enableAllExtensions(gl)

        this.canvasWidth = gl.canvas.width
        this.canvasHeight = gl.canvas.height

        this.normalShader = await createShader(gl, '/shader/normal.glsl')
        this.lodMapShader = await createShader(gl, '/shader/lodMap.glsl')
        this.dLodMapShader = await createShader(gl, '/shader/dLodMap.glsl')
        this.terrainLineShader = await createShader(gl, '/shader/terrainMeshLine.glsl')
        this.terrainMeshShader = await createShader(gl, '/shader/terrainMesh.glsl')
        this.terrainShader = this.asLine ? this.terrainLineShader : this.terrainMeshShader
        this.showShader = await createShader(gl, '/shader/terrainLayer.glsl')

        const demImageBitmap = await loadImage('/images/dem.png')
        const contourPaletteBitmap = await loadImage('/images/contourPalette1D.png')
        this.demTexture = createTexture2D(gl, demImageBitmap.width, demImageBitmap.height, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, demImageBitmap)
        this.paletteTexture = createTexture2D(gl, contourPaletteBitmap.width, contourPaletteBitmap.height, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, contourPaletteBitmap)

        this.boxTexture = createTexture2D(gl, this.nodeBoxArray.length / 4, 1, gl.RGBA32F, gl.RGBA, gl.FLOAT, this.nodeBoxArray)
        this.levelTexture = createTexture2D(gl, this.nodeLevelArray.length, 1, gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT, this.nodeLevelArray)
        this.indexTexture = createTexture2D(gl, this.indexTextureSize, this.indexTextureSize, gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT, this.indexTextureArray)
        this.positionTexture = createTexture2D(gl, this.positionTextureSize, this.positionTextureSize, gl.RG32F, gl.RG, gl.FLOAT, this.positionTextureArray)

        //////////////////////////////
        this.normalTexture = createTexture2D(gl, demImageBitmap.width, demImageBitmap.height, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE)
        const normalPass = createFrameBuffer(gl, [ this.normalTexture ])

        gl.bindFramebuffer(gl.FRAMEBUFFER, normalPass)
        gl.viewport(0.0, 0.0, demImageBitmap.width, demImageBitmap.height)
        gl.clearColor(0.0, 0.0, 0.0, 0.0)
        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.useProgram(this.normalShader)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.demTexture)

        gl.uniform1i(gl.getUniformLocation(this.normalShader, 'demTexture'), 0)
        gl.uniform1f(gl.getUniformLocation(this.normalShader, 'exaggeration'), this.exaggeration)
        gl.uniform2fv(gl.getUniformLocation(this.normalShader, 'e'), new Float32Array(this.elevationRange))

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

        //////////////////////////////

        this.lodMapTexture = createTexture2D(gl, this.lodMapSize[0], this.lodMapSize[1], gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT)
        this.dLodMapTexture = createTexture2D(gl, this.lodMapSize[0], this.lodMapSize[1], gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT)
        this.layerDepthTexture = createTexture2D(gl, this.canvasWidth, this.canvasHeight, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT)
        this.layerTexture = createTexture2D(gl, this.canvasWidth, this.canvasHeight, gl.RGBA32F, gl.RGBA, gl.FLOAT)
        this.layerTextureMaxMipLevel = getMaxMipLevel(this.canvasWidth, this.canvasHeight)

        this.layerRenderBuffer = createRenderBuffer(gl, this.canvasWidth, this.canvasHeight)

        this.lodMapPass = createFrameBuffer(gl, [ this.lodMapTexture ])
        this.dLodMapPass = createFrameBuffer(gl, [ this.dLodMapTexture ])
        this.layerPass = createFrameBuffer(gl, [ this.layerTexture ], this.layerDepthTexture)

        this.isInitialized = true
    }

    /**
     * @param { WebGL2RenderingContext } gl
     * @param { [number] } matrix  
     */
    render(gl, matrix) {

        // No render condition
        if (!this.isInitialized) return
        this.map.update()

        this.registerRenderableNode({
            cameraPos: this.map.mercatorCenter.toLngLat().toArray(),
            cameraBounds: this.map.cameraBounds,
            zoomLevel: this.map.getZoom(),
        })

        fillTexture2DByArray(gl, this.boxTexture, this.nodeBoxArray.length / 4, 1, gl.RGBA32F, gl.RGBA, gl.FLOAT, this.nodeBoxArray)
        fillTexture2DByArray(gl, this.levelTexture, this.nodeLevelArray.length, 1, gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT, this.nodeLevelArray)

        // const wmcMatrix = getMercatorMatrix(this.map.transform.clone())
        // const relativeMatrix = new THREE.Matrix4().fromArray(wmcMatrix).multiply(new THREE.Matrix4().makeTranslation(this.map.centerHigh[0], this.map.centerHigh[1], 0.0))
        // console.log(this.nodeBoxArray)

        /////////////////////////////////////////////////////

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.lodMapPass)
        gl.viewport(0.0, 0.0, this.lodMapSize[0], this.lodMapSize[1])
        const clearValue = new Uint32Array([0, 0, 0, 0])
        gl.clearBufferuiv(gl.COLOR, 0, clearValue)

        gl.useProgram(this.lodMapShader)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.boxTexture)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.levelTexture)

        gl.uniform1i(gl.getUniformLocation(this.lodMapShader, 'boxTexture'), 0)
        gl.uniform1i(gl.getUniformLocation(this.lodMapShader, 'levelTexture'), 1)
        gl.uniform2fv(gl.getUniformLocation(this.lodMapShader, 'dimensions'), new Float32Array(this.lodMapSize))
        gl.uniform2fv(gl.getUniformLocation(this.lodMapShader, 'sectorRange'), new Float32Array(this.sectorRange))
        gl.uniform4fv(gl.getUniformLocation(this.lodMapShader, 'tileBox'), new Float32Array(this.tileBox.boundary.xyzw))

        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.nodeCount)

        /////////////////////////////////////////////////////

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.dLodMapPass)
        gl.viewport(0.0, 0.0, this.lodMapSize[0], this.lodMapSize[1])
        gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([0, 0, 0, 0]))

        gl.useProgram(this.dLodMapShader)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.lodMapTexture)

        gl.uniform1i(gl.getUniformLocation(this.lodMapShader, 'lodMap'), 0)

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

        /////////////////////////////////////////////////////
        this.terrainShader = this.asLine ? this.terrainLineShader : this.terrainMeshShader

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerPass)
        gl.viewport(0.0, 0.0, this.canvasWidth, this.canvasHeight)
        gl.clearColor(1000.0, 0.0, 0.0, 0.0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        gl.enable(gl.DEPTH_TEST)
        // gl.depthFunc(gl.LESS)

        gl.disable(gl.BLEND)
        // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        // gl.blendEquation(gl.FUNC_ADD)
        // gl.blendFunc(gl.ONE, gl.ZERO)

        // gl.useProgram(this.terrainMeshLineShader)
        gl.useProgram(this.terrainShader)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.indexTexture)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.positionTexture)
        gl.activeTexture(gl.TEXTURE2)
        gl.bindTexture(gl.TEXTURE_2D, this.levelTexture)
        gl.activeTexture(gl.TEXTURE3)
        gl.bindTexture(gl.TEXTURE_2D, this.boxTexture)
        gl.activeTexture(gl.TEXTURE4)
        gl.bindTexture(gl.TEXTURE_2D, this.dLodMapTexture)
        gl.activeTexture(gl.TEXTURE5)
        gl.bindTexture(gl.TEXTURE_2D, this.demTexture)
        gl.activeTexture(gl.TEXTURE6)
        gl.bindTexture(gl.TEXTURE_2D, this.normalTexture)

        gl.uniform1i(gl.getUniformLocation(this.terrainShader, 'indicesTexture'), 0)
        gl.uniform1i(gl.getUniformLocation(this.terrainShader, 'positionsTexture'), 1)
        gl.uniform1i(gl.getUniformLocation(this.terrainShader, 'levelTexture'), 2)
        gl.uniform1i(gl.getUniformLocation(this.terrainShader, 'boxTexture'), 3)
        gl.uniform1i(gl.getUniformLocation(this.terrainShader, 'dLodMap'), 4)
        gl.uniform1i(gl.getUniformLocation(this.terrainShader, 'demTexture'), 5)
        gl.uniform1i(gl.getUniformLocation(this.terrainShader, 'normalTexture'), 6)
        gl.uniform1f(gl.getUniformLocation(this.terrainShader, 'sectorSize'), this.sectorSize)
        gl.uniform1f(gl.getUniformLocation(this.terrainShader, 'worldSize'), this.map.WORLD_SIZE)
        gl.uniform1f(gl.getUniformLocation(this.terrainShader, 'exaggeration'), this.exaggeration)
        gl.uniform2fv(gl.getUniformLocation(this.terrainShader, 'centerHigh'), this.map.centerHigh)
        gl.uniform2fv(gl.getUniformLocation(this.terrainShader, 'centerLow'), this.map.centerLow)
        gl.uniform1f(gl.getUniformLocation(this.terrainShader, 'maxLodLevel'), this.maxVisibleNodeLevel)
        gl.uniform1f(gl.getUniformLocation(this.terrainShader, 'maxMipLevel'), this.layerTextureMaxMipLevel)
        gl.uniform2fv(gl.getUniformLocation(this.terrainShader, 'e'), new Float32Array(this.elevationRange))
        gl.uniform2fv(gl.getUniformLocation(this.terrainShader, 'sectorRange'), new Float32Array(this.sectorRange))
        gl.uniform4fv(gl.getUniformLocation(this.terrainShader, 'tileBox'), new Float32Array(this.tileBox.boundary.xyzw))
        gl.uniform4fv(gl.getUniformLocation(this.terrainShader, 'terrainBox'), new Float32Array(this.boundaryCondition.boundary.xyzw))
        // gl.uniformMatrix4fv(gl.getUniformLocation(this.terrainMeshShader, 'uMatrix'), false, relativeMatrix.elements)
        gl.uniformMatrix4fv(gl.getUniformLocation(this.terrainShader, 'uMatrix'), false, this.map.relativeEyeMatrix)
        // gl.uniformMatrix4fv(gl.getUniformLocation(this.terrainShader, 'vpMatrix'), false, this.map.vpMatrix.elements)

        this.asLine ? gl.drawArraysInstanced(gl.LINES, 0, this.indexNum / 3 * 6, this.nodeCount)
        : gl.drawArraysInstanced(gl.TRIANGLES, 0, this.indexNum, this.nodeCount)

        /////////////////////////////////////////////////////

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0.0, 0.0, gl.canvas.width, gl.canvas.height)

        gl.disable(gl.DEPTH_TEST)

        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(this.showShader)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.layerTexture)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture)
        gl.activeTexture(gl.TEXTURE2)
        gl.bindTexture(gl.TEXTURE_2D, this.layerDepthTexture)
        gl.activeTexture(gl.TEXTURE3)
        gl.bindTexture(gl.TEXTURE_2D, this.normalTexture)
        gl.activeTexture(gl.TEXTURE4)
        gl.bindTexture(gl.TEXTURE_2D, this.lodMapTexture)

        gl.uniform1i(gl.getUniformLocation(this.showShader, 'srcTexture'), 0)
        gl.uniform1i(gl.getUniformLocation(this.showShader, 'paletteTexture'), 1)
        gl.uniform1i(gl.getUniformLocation(this.showShader, 'depthTexture'), 2)
        gl.uniform1i(gl.getUniformLocation(this.showShader, 'normalTexture'), 3)
        gl.uniform1i(gl.getUniformLocation(this.showShader, 'lodMapTexture'), 4)
        gl.uniform1f(gl.getUniformLocation(this.showShader, 'interval'), this.interval)
        gl.uniform1f(gl.getUniformLocation(this.showShader, 'asLine'), this.asLine ? 1.0 : 0.0)
        gl.uniform1f(gl.getUniformLocation(this.showShader, 'maxMipLevel'), this.layerTextureMaxMipLevel)
        gl.uniform2fv(gl.getUniformLocation(this.showShader, 'e'), new Float32Array(this.elevationRange))
        gl.uniform3fv(gl.getUniformLocation(this.showShader, 'contourColor'), new Float32Array(this.color))

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

        /////////////////////////////////////////////////////
        // Check for errors
        const error = gl.getError()
        if (error !== gl.NO_ERROR) {
            console.error('Error happened: ', getWebGLErrorMessage(gl, error))
        }
    }

    /**
     * @param { { cameraPos: { x: number, y: number, z: number }, cameraBounds: BoundingBox2D, zoomLevel: number } } options 
     */
    registerRenderableNode(options) {
        
        // Reset uiform-related member per frame
        this.tileBox.reset()
        this.sectorRange.fill(0)
        this.nodeCount = 0
        this.maxVisibleNodeLevel = 0
        this.minVisibleNodeLevel = this.maxLevel

        // Find visible terrain nodes
        /** @type { Node2D[] } */ const stack = [] 
        /** @type { Node2D[] } */ const visibleNode = []
        stack.push(new Node2D(0, 0))
        stack.push(new Node2D(0, 1))
        while(stack.length > 0) {
            
            let node = stack.pop()

            // Termination condition #1
            if (!node.bBox.overlap(this.boundaryCondition)) continue
            // Termination condition #2
            if (!node.isSubdividable(options) || node.level >= Math.min(this.maxLevel, options.zoomLevel)) {
                
                visibleNode.push(node)
                // Update the sector size used for rendering
                if (node.level > this.maxVisibleNodeLevel) {

                    this.sectorRange[0] = node.bBox.size[0]
                    this.sectorRange[1] = node.bBox.size[1]
                    this.maxVisibleNodeLevel = node.level
                }
                continue
            }

            // If the terrain node is subdividable
            // Create its child nodes
            for (let i = 0; i < 4; i++) {

                node.children[i] = new Node2D(node.level + 1, 4 * node.id + i, node)
                stack.push(node.children[i])
            }
        }

        // Further determinate the real visible nodes
        // Give priority to high-level ones ?
        visibleNode./*sort((a, b) => a.level - b.level).*/forEach(node => {

            if (this.nodeCount < this.maxNodeCount || node.level + 5 >= this.maxVisibleNodeLevel) {

                this.minVisibleNodeLevel = node.level < this.minVisibleNodeLevel ? node.level : this.minVisibleNodeLevel
                this.tileBox.updateByBox(node.bBox)
    
                this.nodeLevelArray[ this.nodeCount ] = node.level
                this.nodeBoxArray[this.nodeCount * 4 + 0] = node.bBox.boundary.x
                this.nodeBoxArray[this.nodeCount * 4 + 1] = node.bBox.boundary.y
                this.nodeBoxArray[this.nodeCount * 4 + 2] = node.bBox.boundary.z
                this.nodeBoxArray[this.nodeCount * 4 + 3] = node.bBox.boundary.w
    
                this.nodeCount++
            }

            node.release()
        })

        // console.log(this.nodeCount)
        // console.log(this.map.getZoom(), Math.ceil((this.tileBox.xMax - this.tileBox.xMin) / this.sectorRange[0]))
    }
    
}

// Helpers //////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * @param {WebGL2RenderingContext} gl 
 */
function enableAllExtensions(gl) {

    const extensions = gl.getSupportedExtensions()
    extensions.forEach(ext => {
        gl.getExtension(ext)
        // console.log('Enabled extensions: ', ext)
    })
}

/** 
 * @param {WebGL2RenderingContext} gl  
 * @param {string} url 
 */
async function createShader(gl, url) {

    let shaderCode = ''
    await axios.get(url)
    .then(response => shaderCode += response.data)
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

/**
 * @param { WebGL2RenderingContext } gl 
 * @param { WebGLTexture[] } [ textures ] 
 * @param { WebGLRenderbuffer } [ depthTexture ] 
 * @param { WebGLRenderbuffer } [ renderBuffer ] 
 * @returns { WebGLFramebuffer }
 */
function createFrameBuffer(gl, textures, depthTexture, renderBuffer) {

    const frameBuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer)

    textures?.forEach((texture, index) => {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + index, gl.TEXTURE_2D, texture, 0)
    })

    if (depthTexture) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0)
    }

    if (renderBuffer) {

        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, renderBuffer)
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {

        console.error('Framebuffer is not complete')
    }

    return frameBuffer
}

/**
 * @param { WebGL2RenderingContext } gl 
 * @param { number } width 
 * @param { number } height 
 * @param { number } internalFormat 
 * @param { number } format 
 * @param { number } type 
 * @param { ArrayBufferTypes | ImageBitmap } [ resource ]
 */
function createTexture2D(gl, width, height, internalFormat, format, type, resource, generateMips = false) {
    
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, generateMips ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, resource ? resource : null)

    gl.bindTexture(gl.TEXTURE_2D, null)

    return texture
}


/**
 * @param { WebGL2RenderingContext } gl 
 * @param { number } width 
 * @param { number } height 
 * @param { number } internalFormat 
 * @param { number } format 
 * @param { number } type 
 * @param { ArrayBufferTypes } array
 */
function fillTexture2DByArray(gl, texture, width, height, internalFormat, format, type, array) {
    
    // Bind the texture
    gl.bindTexture(gl.TEXTURE_2D, texture)

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

    // Upload texture data
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, array);

    // Unbind the texture
    gl.bindTexture(gl.TEXTURE_2D, null);
}

/**
 * @param { WebGL2RenderingContext } gl 
 * @param { number } [ width ] 
 * @param { number } [ height ] 
 * @returns { WebGLRenderbuffer }
 */
function createRenderBuffer(gl, width, height) {

    const bufferWidth = width || gl.canvas.width * window.devicePixelRatio
    const bufferHeight = height || gl.canvas.height * window.devicePixelRatio

    const renderBuffer = gl.createRenderbuffer()
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, bufferWidth, bufferHeight)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)

    return renderBuffer
}

// Helper function to get WebGL error messages
function getWebGLErrorMessage(gl, error) {
    switch (error) {
        case gl.NO_ERROR:
            return 'NO_ERROR';
        case gl.INVALID_ENUM:
            return 'INVALID_ENUM';
        case gl.INVALID_VALUE:
            return 'INVALID_VALUE';
        case gl.INVALID_OPERATION:
            return 'INVALID_OPERATION';
        case gl.OUT_OF_MEMORY:
            return 'OUT_OF_MEMORY';
        case gl.CONTEXT_LOST_WEBGL:
            return 'CONTEXT_LOST_WEBGL';
        default:
            return 'UNKNOWN_ERROR';
    }
}

async function loadImage(url) {
    try {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const blob = await response.blob()
        const imageBitmap = await createImageBitmap(blob, { imageOrientation: "flipY", premultiplyAlpha: "none", colorSpaceConversion: "default" })
        return imageBitmap

    } catch (error) {
        console.error(`Error loading image (url: ${url})`, error)
        throw error
    }
}
function getMaxMipLevel(width, height) {
    return Math.floor(Math.log2(Math.max(width, height)));
}