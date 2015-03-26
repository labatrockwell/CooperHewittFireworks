PIXI.HighPassFilter = function()
{
    PIXI.AbstractFilter.call( this );

    this.passes = [this];

    // set the uniforms
    this.uniforms = {
        cutoff: {type: '1f', value: 0.1}
    };

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying vec4 vColor;',
        'uniform sampler2D uSampler;',
        'uniform float cutoff;',

        'void main(void) {',
        '   vec4 color = texture2D(uSampler, vTextureCoord);',
        '   if (color.a < cutoff) discard; ',
        '   gl_FragColor = color;',
        '}'
    ];
};

PIXI.HighPassFilter.prototype = Object.create( PIXI.AbstractFilter.prototype );
PIXI.HighPassFilter.prototype.constructor = PIXI.HighPassFilter;

/**
 * The number of steps to reduce the palette by.
 *
 * @property step
 * @type Number
 */
Object.defineProperty(PIXI.HighPassFilter.prototype, 'cutoff', {
    get: function() {
        return this.uniforms.cutoff.value;
    },
    set: function(value) {
        this.uniforms.cutoff.value = value;
    }
});
