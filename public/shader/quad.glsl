#ifdef VERTEX_SHADER

precision highp float;

layout(location = 0) in vec4 vertex;

uniform vec2 centerHigh;
uniform vec2 centerLow;
uniform float alphaFactor;
uniform mat4 u_matrix;

out vec2 texcoords;

vec4[] vertices = vec4[4](
    vec4(-1.0, 0.0, 0.0, 0.0),
    vec4(0.0, 0.0, 1.0, 0.0),
    vec4(-1.0, 1.0, 0.0, 1.0),
    vec4(0.0, 1.0, 1.0, 1.0)
);

vec2 translateRelativeToEye(vec2 high, vec2 low) {

    vec2 highDiff = high - centerHigh;
    // vec2 lowDiff = low - centerLow;

    return highDiff;// + lowDiff;
}

void main() {

    float highX = vertex.x;
    float lowX = vertex.y;
    float highY = vertex.z;
    float lowY = vertex.w;

    vec2 pos = translateRelativeToEye(vec2(highX, highY), vec2(lowX, lowY));
    // vec2 pos = vec2(highX, highY);

    gl_Position = u_matrix * vec4(pos, 0.0, 1.0);
    texcoords = vertices[gl_VertexID].zw;
}

#endif

#ifdef FRAGMENT_SHADER

precision highp float;

uniform float alphaFactor;

in vec2 texcoords;
out vec4 fragColor;

void main() {

    vec2 distance = abs(vec2(0.5) - texcoords);
    float factor = 0.45;
    
    float alpha = 0.0;
    if (distance.x > factor || distance.y > factor) {
        
        float maxDis = max(distance.x, distance.y);
        float fromEdge = (0.5 - factor) - (0.5 - maxDis);
        alpha = sin(mix(0.0, 1.0, fromEdge / (0.5 - factor)) * 3.141592653 / 2.0);
    }

    // fragColor = vec4(alpha * alphaFactor);
    fragColor = vec4(max(alpha, alphaFactor));
    // fragColor = vec4(0.5);
    // fragColor = vec4(0.12, 0.61, 0.84, 1.0);
}

#endif