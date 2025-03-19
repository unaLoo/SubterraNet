#ifdef VERTEX_SHADER

precision highp float;

out vec2 texcoords;

vec4[] vertices = vec4[4](vec4(-1.0, -1.0, 0.0, 0.0), vec4(1.0, -1.0, 1.0, 0.0), vec4(-1.0, 1.0, 0.0, 1.0), vec4(1.0, 1.0, 1.0, 1.0));

void main() {

    vec4 attributes = vertices[gl_VertexID];

    gl_Position = vec4(attributes.xy, 0.0, 1.0);
    texcoords = attributes.zw;
}

#endif

#ifdef FRAGMENT_SHADER

precision highp int;
precision highp float;
precision highp usampler2D;

in vec2 texcoords;

uniform sampler2D srcTexture;
uniform sampler2D paletteTexture;
uniform sampler2D depthTexture;
uniform sampler2D normalTexture;
uniform usampler2D lodMapTexture;

uniform vec2 e;
uniform float maxMipLevel;
uniform float interval;
uniform float asLine;
uniform vec3 contourColor;

out vec4 fragColor;

vec3 colorMap(int index) {

    vec3 palette[11] = vec3[11](vec3(36.0, 73.0, 140.0),
        // vec3(158.0, 1.0, 66.0),
    vec3(213.0, 62.0, 79.0), vec3(244.0, 109.0, 67.0), vec3(253.0, 174.0, 97.0), vec3(254.0, 224.0, 139.0), vec3(255.0, 255.0, 191.0), vec3(230.0, 245.0, 152.0), vec3(171.0, 221.0, 164.0), vec3(102.0, 194.0, 165.0), vec3(50.0, 136.0, 189.0), vec3(94.0, 79.0, 162.0));

    return palette[index] / 255.0;
}

vec2 uvCorrection(vec2 uv) {
    return clamp(uv, vec2(0.0), vec2(1.0));
}

bool isOnLine(float elevation) {

    // return mod(fract(elevation) >= 0.5 ? ceil(elevation) : floor(elevation), _step) == 0.0;
    return mod(floor(e.y - elevation), interval) == 0.0;
    // return fract(elevation) <= 0.99 && mod(floor(elevation), _step) == 0.0;
}

vec4 loadTerrainInfo(vec2 uv, vec2 offset) {

    vec2 dim = vec2(textureSize(depthTexture, 0));
    vec2 _uv = uv + offset / dim;
    // float depth = texture(depthTexture, _uv).r;
    float depth = texelFetch(depthTexture, ivec2(uv * dim + offset), 0).r * 0.5 + 0.5;
    float lod = (maxMipLevel) * (1.0 - depth);
    // return textureLod(srcTexture, _uv, lod).r;

    return texelFetch(srcTexture, ivec2(uv * dim + offset), 0);
    // int highMip = int(lod);
    // int lowMip = int(lod + 1.0);

    // vec2 highDim = vec2(textureSize(srcTexture, highMip));
    // vec2 lowDim = vec2(textureSize(srcTexture, lowMip));

    // float highElevation = texelFetch(srcTexture, ivec2(uv * highDim + offset), highMip).r;
    // float lowElevation = texelFetch(srcTexture, ivec2(uv * lowDim + offset), lowMip).r;

    // return mix(highElevation, lowElevation, fract(lod));
}

vec3 colorMapping(float elevation) {

    vec3[] palette = vec3[7](vec3(170.0, 196.0, 78.0) / 255.0, vec3(171.0, 214.0, 93.0) / 255.0, vec3(172.0, 213.0, 101.0) / 255.0, vec3(103.0, 206.0, 172.0) / 255.0, vec3(76.0, 210.0, 121.0) / 255.0, vec3(31.0, 196.0, 224.0) / 255.0, vec3(55.0, 174.0, 217.0) / 255.0);

    // int index = int(rate * 7.0);
    // return palette[index] * 1.2;

    float intervalNum = floor((e.y - e.x) / interval);
    float intervalIndex = floor((e.y - elevation) / interval);
    float rate = pow(2.71828, -0.7 * (1.0 - intervalIndex / intervalNum));
    vec2 uv = vec2(rate, 0.5);
    return texture(paletteTexture, uv).rgb;

    // int index = int((e.y - elevation) / interval);
    // index = clamp(0, 6, index);
    // return palette[index] * 1.2;
}

int withinInterval(float elevation) {

    return int((e.y - elevation) / interval);
}

void main() {

    float depth = texture(depthTexture, texcoords).r * 0.5 + 0.5;
    // float interval = 0.5;

    float factor = 1.0;
    vec4 M = loadTerrainInfo(texcoords, vec2(0.0, 0.0));
    vec4 N = loadTerrainInfo(texcoords, vec2(0.0, factor));
    vec4 E = loadTerrainInfo(texcoords, vec2(factor, 0.0));
    vec4 S = loadTerrainInfo(texcoords, vec2(0.0, -factor));
    vec4 W = loadTerrainInfo(texcoords, vec2(-factor, 0.0));

    float depthRate = (M.r - e.x) / (e.y - e.x);

    int intervalM = withinInterval(M.r);
    int intervalN = withinInterval(N.r);
    int intervalE = withinInterval(E.r);
    int intervalS = withinInterval(S.r);
    int intervalW = withinInterval(W.r);

    // bool judgeN = isOnLine(N);
    // bool judgeE = isOnLine(E);
    // bool judgeS = isOnLine(S);
    // bool judgeW = isOnLine(W);

    // int visibility = 0;
    // if (N > M && !isOnLine(N, interval)) {
    //     visibility++;
    // }

    if(M.r > e.y) {

        fragColor = vec4(0.0);
    } 
    else if(intervalN < intervalM || intervalE < intervalM || intervalS < intervalM || intervalW < intervalM) {

        fragColor = vec4(0.4,0.4,0.4,0.8);
        if(intervalM == 0) {
            fragColor = vec4(0.0);
        } else if(intervalM % 6 == 0) {
            fragColor = vec4(0.65, 0.04, 0.04,1.0);
        } else if(intervalM % 10 == 0) {
            fragColor = vec4(0.03, 0.29, 0.46,1.0);
        }
    } 
    else {

        vec3 lightPosition = vec3(100.0, -100.0, 20.0);
        vec3 lightDir = normalize(lightPosition - vec3(0.0));
        vec3 norm = M.gba;
        float diff = max(dot(norm, lightDir), 0.0);

        vec3 intervalColor = colorMapping(M.r);
        // fragColor = vec4(intervalColor, 1.0 - pow(2.71828, -20.0 * (1.0 - depthRate)));
        // fragColor = vec4(vec3(0.5), 1.0 - pow(2.71828, -0.5 * (1.0 - depthRate)));
        // fragColor = vec4(intervalColor, 1.0);
        // fragColor = vec4(intervalColor, 1.0);

        // fragColor = vec4(intervalColor * (diff + 0.5), 1.0 - pow(2.71828, -20.0 * (1.0 - depthRate)));
        fragColor = vec4(intervalColor, 1.0 - pow(2.71828, -20.0 * (1.0 - depthRate)));

        // fragColor = vec4(M.gba, 1.0);
    }

    // fragColor = texture(normalTexture, texcoords);
    if(asLine == 1.0) {
        fragColor = vec4(M);

        // ivec2 dim = textureSize(lodMapTexture, 0) - 1;
        // ivec2 uv = ivec2(texcoords * vec2(dim));
        // float index = float(texelFetch(lodMapTexture, uv, 0).r);
        // vec3 color = colorMap(int(mod(index, 11.0))) * 1.2;
        // fragColor = vec4(color, 1.0);
    }
}

#endif