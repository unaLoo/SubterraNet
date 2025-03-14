import * as THREE from 'three'

const MY_WORLD_SIZE = 1024000
// const MY_WORLD_SIZE = 102400

export function updateMyWolrdCamera(transform, mercatorWorldSize, minElevation = 0.0) {

    const fov = transform._fov
    const halfFov = transform._fov / 2

    const angle = transform.angle
    const pitch = transform._pitch

    const aspect = transform.width / transform.height

    const cameraToCenterDistance = 0.5 / Math.tan(halfFov) * mercatorWorldSize / transform.scale * transform.height / 512.0
    const cameraToSeaLevelDistance = ((transform._camera.position[2] * mercatorWorldSize) - minElevation) / Math.cos(pitch)
    const topHalfSurfaceDistance = Math.sin(halfFov) * cameraToSeaLevelDistance / Math.sin(Math.max(Math.PI / 2.0 - pitch - halfFov, 0.01))
    const furthestDistance = Math.sin(pitch) * topHalfSurfaceDistance + cameraToSeaLevelDistance
    const horizonDistance = cameraToSeaLevelDistance / transform._horizonShift
    const farZ = Math.min(furthestDistance * 1.01, horizonDistance)

    const pitchMatrix = new THREE.Matrix4().makeRotationX(pitch)
    const angleMatrix = new THREE.Matrix4().makeRotationZ(angle)
    const worldToCamera = pitchMatrix.premultiply(angleMatrix)

    const x = transform.pointMerc.x
    const y = transform.pointMerc.y
    const centerX = (x - 0.5) * mercatorWorldSize
    const centerY = (0.5 - y) * mercatorWorldSize
    const center = new THREE.Vector3(centerX, centerY, 0)

    const up = new THREE.Vector3(0, 1, 0)
        .applyMatrix4(angleMatrix)

    const position = new THREE.Vector3(0, 0, 1)
        .applyMatrix4(worldToCamera)
        .multiplyScalar(cameraToCenterDistance)
        .add(center)

    const view = new THREE.Matrix4().makeTranslation(position.x, position.y, position.z).multiply(worldToCamera).invert()

    return {
        position,
        center,
        up,
        fov,
        aspect,
        farZ,
        view,
        nearZ: cameraToCenterDistance / 200,
    }
}

export function makePerspectiveMatrix(fovy, aspect, near, far) {

    var out = new THREE.Matrix4()
    var f = 1.0 / Math.tan(fovy / 2),
        nf = 1 / (near - far)

    var newMatrix = [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, (2 * far * near) * nf, 0
    ]

    out.elements = newMatrix
    return out
}


export function calcMatrix(mapbox_transform, modelOriginInMyWorld) {
    ///////////////////////////////////////////////////////////////////
    /////////////////////////// Three matrix//////////////////////////
    ///////////////////////////////////////////////////////////////////
    const xCamera = updateMyWolrdCamera(mapbox_transform.clone(), MY_WORLD_SIZE, 0.0)
    const flip = new THREE.Matrix4().set(
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0,
    )

    const xModel = new THREE.Matrix4().makeTranslation(modelOriginInMyWorld[0], modelOriginInMyWorld[1], 0.0)
    const xView = xCamera.view
    const xProjection = makePerspectiveMatrix(xCamera.fov, xCamera.aspect, xCamera.nearZ, xCamera.farZ)
    const xMVP = xProjection.multiply(xView).multiply(xModel)

    return xMVP
}


export function mercatorXfromLng(lng) {
    return (180 + lng) / 360;
}

export function mercatorYfromLat(lat) {
    return (180 - (180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)))) / 360;
}

export function mercatorFromLngLat(lnglat) {
    return [
        mercatorXfromLng(lnglat[0]),
        mercatorYfromLat(lnglat[1])
    ]
}

export function lnglat2MyWorld(lnglat) {
    const worldSize = MY_WORLD_SIZE
    const WMC = mercatorFromLngLat(lnglat)
    return [
        (WMC[0] - 0.5) * worldSize,
        (0.5 - WMC[1]) * worldSize
    ]
}

export function mercator2MyWorld(WMC) {
    const worldSize = MY_WORLD_SIZE
    return [
        (WMC[0] - 0.5) * worldSize,
        (0.5 - WMC[1]) * worldSize
    ]
}