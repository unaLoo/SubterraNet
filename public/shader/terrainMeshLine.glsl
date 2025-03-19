#ifdef VERTEX_SHADER

precision highp float;
precision highp sampler2D;
precision highp usampler2D;

uniform usampler2D indicesTexture;
uniform sampler2D positionsTexture;
uniform usampler2D levelTexture;
uniform sampler2D boxTexture;

uniform sampler2D demTexture;
uniform usampler2D dLodMap;

uniform vec4 terrainBox;
uniform vec2 e;
uniform float far;
uniform float near;
uniform mat4 uMatrix;
uniform vec2 centerLow;
uniform vec2 centerHigh;
uniform vec4 tileBox;
uniform vec2 sectorRange;
uniform float sectorSize;
uniform float maxLodLevel;
uniform float exaggeration;

out float vDepth;
out float vIndex;


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

ivec2 indexToUV(sampler2D texture, int index) {

    int dim = textureSize(texture, 0).x;
    int x = index % dim;
    int y = index / dim;

    return ivec2(x, y);
}

ivec2 indexToUV(usampler2D texture, int index) {

    int dim = textureSize(texture, 0).x;
    int x = index % dim;
    int y = index / dim;

    return ivec2(x, y);
}

vec2 calculateIncenter(vec2 A, vec2 B, vec2 C) {

    float a = length(B - C);
    float b = length(A - C);
    float c = length(A - B);
    float sum = a + b + c;

    float x_i = (a * A.x + b * B.x + c * C.x) / sum;
    float y_i = (a * A.y + b * B.y + c * C.y) / sum;

    return vec2(x_i, y_i);
}

vec2 centering(int triangleID, float level) {
    
    int v1ID = triangleID * 3 + 0;
    int v2ID = triangleID * 3 + 1;
    int v3ID = triangleID * 3 + 2;

    int v1Index = int(texelFetch(indicesTexture, indexToUV(indicesTexture, v1ID), 0).r);
    int v2Index = int(texelFetch(indicesTexture, indexToUV(indicesTexture, v2ID), 0).r);
    int v3Index = int(texelFetch(indicesTexture, indexToUV(indicesTexture, v3ID), 0).r);

    vec2 v1 = texelFetch(positionsTexture, indexToUV(positionsTexture, v1Index), 0).rg;
    vec2 v2 = texelFetch(positionsTexture, indexToUV(positionsTexture, v2Index), 0).rg;
    vec2 v3 = texelFetch(positionsTexture, indexToUV(positionsTexture, v3Index), 0).rg;

    vec2 dir21 = normalize(v2 - v1);
    vec2 dir31 = normalize(v3 - v1);
    float dis = 1.0 / sectorSize / pow(2.0, maxLodLevel - level);
    vec2 _v2 = v1 + dir21 * dis;
    vec2 _v3 = v1 + dir31 * dis;

    // return (v1 + v2 + v3) / 3.0;
    // return v1 + (dir21 + dir31) * dis / 3.0;
    return calculateIncenter(v1, _v2, _v3);
}

float stitching(float coord, float minVal, float delta, float edge) {
    float order = mod(floor((coord - minVal) / delta), pow(2.0, edge));
    return -order * delta;
}



void main() {
    int triangleID = gl_VertexID / 6;
    int vertexID = triangleID * 3 + (gl_VertexID - triangleID * 6) % 3;

    float level = float(texelFetch(levelTexture, ivec2(gl_InstanceID, 0), 0).r);
    int index = int(texelFetch(indicesTexture, indexToUV(indicesTexture, vertexID), 0).r);
    float x = texelFetch(positionsTexture, indexToUV(positionsTexture, index), 0).r;
    float y = texelFetch(positionsTexture, indexToUV(positionsTexture, index), 0).g;

    vec2 center = centering(triangleID, level);
    vec4 nodeBox = texelFetch(boxTexture, ivec2(gl_InstanceID, 0), 0);

    vec2 coord = vec2(
        mix(nodeBox[0], nodeBox[2], x),
        clamp(mix(nodeBox[1], nodeBox[3], y), -85.0, 85.0)
    );
    vec2 centeroidCoord = vec2(
        mix(nodeBox[0], nodeBox[2], center.x),
        clamp(mix(nodeBox[1], nodeBox[3], center.y), -85.0, 85.0)
    );

    // centeroidCoord = vec2(
    //     nodeBox[0] + floor((coord.x - nodeBox[0]) / sectorRange.x) * sectorRange.x + 0.5 * sectorRange.x,
    //     nodeBox[1] + floor((coord.y - nodeBox[1]) / sectorRange.y) * sectorRange.y + 0.5 * sectorRange.y
    // );

    // centeroidCoord = coord;

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
        // offset.y = stitching(coord.y, nodeBox.y, deltaXY.y, dVertical);

        float interval = deltaXY.y * pow(2.0, dVertical);
        coord.y = nodeBox[3] - interval * floor((nodeBox[3] - coord.y) / interval);
    }

    if ((coord.y == nodeBox.y || coord.y == nodeBox.w)) {
        float dHorizontal = (coord.y == nodeBox.y) ? N : S;
        // offset.x = stitching(coord.x, nodeBox.x, deltaXY.x, dHorizontal);

        float interval = deltaXY.x * pow(2.0, dHorizontal);
        coord.x  = nodeBox[0] + interval * floor((coord.x - nodeBox[0]) / interval);
    }

    // coord += offset;
    vec2 uv = calcUVFromCoord(coord);
    vec2 dim = vec2(textureSize(demTexture, 0));

    float elevation = mix(e.x, e.y, linearSampling(demTexture, uv * dim, dim).r);
    float z = exaggeration * altitude2Mercator(coord.y, elevation);
    z = (z <= 0.0) ? z : 0.0;

    gl_Position = positionCS(coord, z);
    // vDepth = (elevation - e.x) / (e.y - e.x);
    vIndex = level;
    vIndex = float(dLevels);
}

#endif

#ifdef FRAGMENT_SHADER

precision highp float;

in float vDepth;
in float vIndex;
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
    vec3 color = colorMap(uint(mod(vIndex, 11.0))) * 1.2;
    fragColor = vec4(color, 1.0);
}

#endif