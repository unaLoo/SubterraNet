#ifdef VERTEX_SHADER

precision highp float;
precision highp int;
precision highp sampler2D;
precision highp usampler2D;

uniform usampler2D indicesTexture;
uniform sampler2D positionsTexture;
uniform usampler2D levelTexture;
uniform sampler2D boxTexture;

uniform sampler2D demTexture;
uniform usampler2D dLodMap;
uniform sampler2D normalTexture;

uniform vec4 terrainBox;
uniform vec2 e;
uniform float far;
uniform float near;
uniform float worldSize;
uniform mat4 uMatrix;
uniform mat4 vpMatrix;
uniform vec2 centerLow;
uniform vec2 centerHigh;
uniform vec4 tileBox;
uniform vec2 sectorRange;
uniform float sectorSize;
uniform float maxLodLevel;
uniform float exaggeration;

out float vDepth;
out float vIndex;
out vec4 vPos;
out vec3 vNorm;


const float PI = 3.141592653;

vec2 calcWebMercatorCoord(vec2 coord) {
    float lon = (180.0 + coord.x) / 360.0;
    float lat = (180.0 - (180.0 / PI * log(tan(PI / 4.0 + coord.y * PI / 360.0)))) / 360.0;
    return vec2(lon, lat);
}

vec2 calcUVFromCoord(vec2 coord) {
    float u = (coord.x - terrainBox[0]) / (terrainBox[2] - terrainBox[0]);
    float v = (coord.y - terrainBox[1]) / (terrainBox[3] - terrainBox[1]);
    return vec2(u, v);
}

vec2 uvCorrection(vec2 uv, vec2 dim) {
    return clamp(uv, vec2(0.0), dim - vec2(1.0));
}

vec4 linearSampling(sampler2D texture, vec2 uv, vec2 dim) {
    vec4 tl = textureLod(texture, uv / dim, 0.0);
    vec4 tr = textureLod(texture, uvCorrection(uv + vec2(1.0, 0.0), dim) / dim, 0.0);
    vec4 bl = textureLod(texture, uvCorrection(uv + vec2(0.0, 1.0), dim) / dim, 0.0);
    vec4 br = textureLod(texture, uvCorrection(uv + vec2(1.0, 1.0), dim) / dim, 0.0);
    float mix_x = fract(uv.x);
    float mix_y = fract(uv.y);
    vec4 top = mix(tl, tr, mix_x);
    vec4 bottom = mix(bl, br, mix_x);
    return mix(top, bottom, mix_y);
}

vec4 IDW(sampler2D texture, vec2 uv, vec2 dim, int _step, float p) {

    ivec2 steps = ivec2(_step, int(ceil(float(_step) * dim.y / dim.x)));
    float weightSum = 0.0;
    vec4 value = vec4(0.0);
    for (int i = -steps.x; i < steps.x; i++ ) {
        for (int j = -steps.y; j < steps.y; j++) {

            vec2 offset = vec2(float(i), float(j));
            float _distance = length(offset);
            float w = 1.0 / pow(_distance == 0.0 ? 1.0 : _distance, p);

            vec2 texcoords = uv + offset;
            value += linearSampling(texture, texcoords, dim) * w;
            weightSum += w;
        }
    }

    return value / weightSum;
}

float nan() {
    float a = 0.0;
    float b = 0.0;
    return a / b;
}

vec2 translateRelativeToEye(vec2 high, vec2 low) {
    vec2 highDiff = high - centerHigh;
    vec2 lowDiff = low - centerLow;
    return highDiff;
}

float altitude2Mercator(float lat, float alt) {
    const float earthRadius = 6371008.8;
    const float earthCircumference = 2.0 * PI * earthRadius;
    return alt / earthCircumference * cos(lat * PI / 180.0);
}

vec4 positionCS(vec2 coord, float z) {
    
    return uMatrix * vec4(translateRelativeToEye(calcWebMercatorCoord(coord), vec2(0.0)), z, 1.0);
}

vec4 positionCS_fromScene(vec2 coord, float elevation) {

    vec2 WMC = calcWebMercatorCoord(coord);
    vec3 position_WS = vec3(
        (WMC.x - 0.5) * worldSize,
        (0.5 - WMC.y) * worldSize,
        elevation
    );
    return vpMatrix * vec4(position_WS, 1.0);
}

ivec2 indexToUV(sampler2D texture, int index) {

    int dim = textureSize(texture, 0).x;
    int x = index % dim;
    int y = index / dim;

    return ivec2(x, y);
}

ivec2 indexToUV_U(usampler2D texture, int index) {

    int dim = textureSize(texture, 0).x;
    int x = index % dim;
    int y = index / dim;

    return ivec2(x, y);
}

vec2 centering(int triangleID, float level) {
    
    int v1ID = triangleID * 3 + 0;
    int v2ID = triangleID * 3 + 1;
    int v3ID = triangleID * 3 + 2;

    int v1Index = int(texelFetch(indicesTexture, indexToUV_U(indicesTexture, v1ID), 0).r);
    int v2Index = int(texelFetch(indicesTexture, indexToUV_U(indicesTexture, v2ID), 0).r);
    int v3Index = int(texelFetch(indicesTexture, indexToUV_U(indicesTexture, v3ID), 0).r);

    vec2 v1 = texelFetch(positionsTexture, indexToUV(positionsTexture, v1Index), 0).rg;
    vec2 v2 = texelFetch(positionsTexture, indexToUV(positionsTexture, v2Index), 0).rg;
    vec2 v3 = texelFetch(positionsTexture, indexToUV(positionsTexture, v3Index), 0).rg;

    vec2 dir21 = normalize(v2 - v1);
    vec2 dir31 = normalize(v3 - v1);
    float dis = 1.0 / sectorSize /  pow(2.0, maxLodLevel - level);

    return v1 + (dir21 + dir31) * dis / 3.0;
}

float stitching(float coord, float minVal, float delta, float edge) {
    float order = mod(floor((coord - minVal) / delta), pow(2.0, edge));
    return -order * delta;
}


void main() {

    int triangleID = int(gl_VertexID) / 3;
    float level = float(texelFetch(levelTexture, ivec2(gl_InstanceID, 0), 0).r);
    int index = int(texelFetch(indicesTexture, indexToUV_U(indicesTexture, int(gl_VertexID)), 0).r);

    float x = texelFetch(positionsTexture, indexToUV(positionsTexture, index), 0).r;
    float y = texelFetch(positionsTexture, indexToUV(positionsTexture, index), 0).g;

    vec2 center = centering(triangleID, level);
    vec4 nodeBox = texelFetch(boxTexture, ivec2(int(gl_InstanceID), 0), 0);

    vec2 coord = vec2(
        mix(nodeBox[0], nodeBox[2], x),
        clamp(mix(nodeBox[1], nodeBox[3], y), -85.0, 85.0)
    );
    vec2 centeroidCoord = vec2(
        mix(nodeBox[0], nodeBox[2], center.x),
        clamp(mix(nodeBox[1], nodeBox[3], center.y), -85.0, 85.0)
    );

    float elevation = 0.0; float depth = 1000.0; vec3 norm = vec3(0.0);
    if (coord.x >= terrainBox.x && coord.y >= terrainBox.y && coord.x <= terrainBox.z && coord.y <= terrainBox.w) {

        vec2 lodDim = vec2(textureSize(dLodMap, 0)) - vec2(1.0);
        vec2 lodUV = vec2(
            floor((centeroidCoord.x - tileBox[0]) / sectorRange.x),
            floor((centeroidCoord.y - tileBox[1]) / sectorRange.y)
        );

        vec2 mLodUV = clamp(lodUV, vec2(0.0, 0.0), lodDim);

        vec2 deltaXY = vec2(nodeBox[2] - nodeBox[0], nodeBox[3] - nodeBox[1]) / sectorSize;

        uint dLevels = texelFetch(dLodMap, ivec2(mLodUV), 0).r;
        float N = float((dLevels >> 24) & 0xFFu);
        float E = float((dLevels >> 16) & 0xFFu);
        float S = float((dLevels >> 8) & 0xFFu);
        float W = float(dLevels & 0xFFu);

        vec2 offset = vec2(0.0);

        if ((coord.x == nodeBox.x || coord.x == nodeBox.z)) {
            float dVertical = (coord.x == nodeBox.x) ? W : E;
            float interval = deltaXY.y * pow(2.0, dVertical);
            coord.y = nodeBox[3] - interval * floor((nodeBox[3] - coord.y) / interval);
        }

        if ((coord.y == nodeBox.y || coord.y == nodeBox.w)) {
            float dHorizontal = (coord.y == nodeBox.y) ? N : S;
            float interval = deltaXY.x * pow(2.0, dHorizontal);
            coord.x  = nodeBox[0] + interval * floor((coord.x - nodeBox[0]) / interval);
        }

        // coord += offset;
        vec2 uv = calcUVFromCoord(coord);
        vec2 dim = vec2(textureSize(demTexture, 0));

        elevation = mix(e.x, e.y, linearSampling(demTexture, uv * dim, dim).r);

        // z = exaggeration * altitude2Mercator(coord.y, elevation);
        // z = (z <= 0.0) ? z : 0.0;
        // elevation = exaggeration * altitude2Mercator(coord.y, elevation);

        // depth = (elevation - e.x) / (e.y - e.x);
        // depth = (z < 0.0) ? elevation : 100.0; 
        depth = elevation;
        elevation = (elevation <= 0.0) ? elevation : 0.0;
        // norm = linearSampling(normalTexture, uv * dim, dim).rgb * 2.0 - 1.0;
        norm = IDW(normalTexture, uv * dim, dim, 1, 0.2).rgb * 2.0 - 1.0;
        // norm = texture(normalTexture, uv).rgb * 2.0 - 1.0;
    } 

    // gl_Position = positionCS_fromScene(coord, elevation);
    gl_Position = positionCS(coord, exaggeration * altitude2Mercator(coord.y, elevation));
    // vIndex = float(texelFetch(levelTexture, ivec2(gl_InstanceID, 0), 0).r);
    vIndex = float(gl_VertexID);
    vPos = gl_Position;
    vDepth = depth;
    vNorm = norm;
}

#endif

#ifdef FRAGMENT_SHADER

precision highp float;

in float vDepth;
in float vIndex;
in vec4 vPos;
in vec3 vNorm;

uniform vec2 e;
uniform float maxMipLevel;

out vec4 fragColor;

vec3 colorMap(uint index) {
    vec3 palette[11] = vec3[11](
        vec3(158.0, 1.0, 66.0),
        vec3(213.0, 62.0, 79.0),
        vec3(244.0, 109.0, 67.0),
        vec3(253.0, 174.0, 97.0),
        vec3(254.0, 224.0, 139.0),
        vec3(255.0, 255.0, 191.0),
        vec3(230.0, 245.0, 152.0),
        vec3(171.0, 221.0, 164.0),
        vec3(102.0, 194.0, 165.0),
        vec3(50.0, 136.0, 189.0),
        vec3(94.0, 79.0, 162.0)
    );
    return palette[index] / 255.0;
}

void main() {

    // float zDepth = vPos.z / vPos.w;

    // gl_FragDepth = zDepth; 

    // if (vDepth == 1000.0) {
    //     gl_FragDepth = -100.0;
    // }

    // vec3 color = colorMap(uint(mod(vIndex, 11.0))) * 1.2;
    // fragColor = vec4(color, 0.2);

    // fragColor = vec4(1.0 - vDepth);
    // fragColor = vec4(vDepth);
    fragColor = vec4(vDepth, vNorm);
    // if (fract(vDepth) <= 0.05 && mod(floor(vDepth), 5.0) == 0.0) {

    //     // fragColor = vec4(1.0, 1.0, 1.0, 1.0 - M);
    //     fragColor = vec4(1.0);
    // } else {
    //     float depthRate = (vDepth - e.x) / (e.y - e.x);
    //     fragColor = vec4(vec3(0.5), 1.0 - pow(2.71828, -0.5 * depthRate));
    // }
    // fragColor = vec4(1.0);
}

#endif