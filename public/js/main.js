$(function(){

  var scene

    // radial gradient background 
    , bgBitmap
    , innerCircle
    , outerCircle
    , fgColor='#0026AF'
    , bgColor='#220068'

    // carnegie mansion
    , mansion
    , mansionScale=0.5

    // cooper hewitt collections swatches
    , swatchKeys
    , swatchesByColor={}

    // fireworks
    , fireworks=[]

    // firework launch settings
    , launchDuration=1500
    , launchDurationManual=1
    , launchDelay=100 // delay between firework launches
    , launchMinDelay=10
    , launchMaxDelay=3000
    , launchMinCluster=1
    , launchMaxCluster=3

    // firework burst settings
    , burstDuration=500
    , burstRadiusMin=100
    , burstRadiusMax=150

    // firework particle settings
    , particleMinCount=40
    , particleMaxCount=60
    , particleMinScale=0.05
    , particleMaxScale=0.1
    , particleLifeVariance=250

    // trails
    , trailsEnabled=true
    , fadeSpeed=0.85
    , blendMode=0 // blendModes: { NORMAL:0, ADD:1, MULTIPLY:2, SCREEN:3, OVERLAY:4, DARKEN:5, LIGHTEN:6, COLOR_DODGE:7, COLOR_BURN:8, HARD_LIGHT:9, SOFT_LIGHT:10, DIFFERENCE:11, EXCLUSION:12, HUE:13, SATURATION:14, COLOR:15, LUMINOSITY:16 }

    , debugEnabled=false
    ;



  // GAME
  var game = window.game = new Phaser.Game(window.innerWidth, window.innerHeight, Phaser.WEBGL, '', { preload: preload, create: create, update: update, render: render });

  function preload() {

    game.load.pack('swatches', 'colors/assets.json');
    game.load.image('particle', 'img/particle.png');
    game.load.image('mansion', 'img/mansion.png');

    // background color
    game.stage.setBackgroundColor(bgColor);

    // scale
    game.scale.scaleMode = Phaser.ScaleManager.RESIZE;
    game.scale.fullScreenScaleMode = Phaser.ScaleManager.RESIZE;
    game.scale.setResizeCallback(resize);
    game.scale.onFullScreenChange.add(function(){
      resize(); setTimeout(resize,1000); // workaround; fullscreen event fires before completely resized
    });

    // use trails only if webGL is available
    trailsEnabled = (!game.device.android && !game.device.iOS);

    // assign fullscreen and debug keys
    assignKeys();

    // click and drag draws fireworks
    game.input.onDown.add(launchFirework);
    game.input.addMoveCallback(function(pointer, x, y) {
      if (pointer.isDown && game.time.time-pointer.timeDown>launchDelay){
        launchFirework(pointer);
      }
    });

    // set up double buffer for trails
    trailBitmapData = game.add.bitmapData(window.innerWidth,window.innerHeight);
    trailBitmapSprite = game.add.image(0,0,trailBitmapData);
    offstageBitmapData = game.add.bitmapData(window.innerWidth,window.innerHeight);

    // high pass filter, to clear low alpha values from trail
    game.load.script('highPassFilter', 'js/highPassFilter.js');

  }
   
  function create() {

    $("#loading").hide();
    $("#loaded").show();

    scene = game.add.group();

    // create background gradient
    bgBitmap = game.make.bitmapData(game.world.width, game.world.height);
    bgBitmap.addToWorld();
    innerCircle = new Phaser.Circle(game.world.width/2, game.world.height, 1);
    outerCircle = new Phaser.Circle(game.world.width/2, game.world.height, (game.world.width+game.world.height)*2);

    // create mansion sprite
    mansion = scene.create(game.world.width/2, game.world.height, "mansion");
    mansion.anchor.setTo(0.5, 1.0);
    mansion.scale.x = mansion.scale.y = mansionScale;

    // sort swatch keys by color
    var cacheKeys = game.cache.getKeys(Phaser.Cache.IMAGE);
    swatchKeys = cacheKeys.filter(function(e){ return e!=="particle" && e!=="mansion"; });
    swatchKeys.forEach(function(swatchImage){
      var color = swatchImage.split("_")[0];
      if (!swatchesByColor[color]) { swatchesByColor[color]=[]; }
      swatchesByColor[color].push(swatchImage);
    });

    // regularly launch clusters of fireworks
    var launchTimer = setTimeout(throttle(timedLaunch,100), random(launchMinDelay,launchMaxDelay) );
    function timedLaunch(){
      var cluster = random(launchMinCluster,launchMaxCluster);
      if (!game.paused){
        for (var i=0; i<cluster; i++){
          _launchFirework( {x:random(game.world.width/3,game.world.width*2/3), y:random(50,game.world.height*2/3)} , true /* auto */ );
        }
      }
      launchTimer = setTimeout(throttle(timedLaunch,100),random(launchMinDelay,launchMaxDelay));
    }

    // high pass filter, to clear low alpha values from trail
    highPassFilter = new PIXI.HighPassFilter(); 
    trailBitmapSprite.filters = [highPassFilter];

  }
   
  function update() {

    // draw background gradient
    if (!game.device.android && !game.device.iOS){
      var bgGradient = bgBitmap.context.createRadialGradient( innerCircle.x, innerCircle.y, innerCircle.radius, outerCircle.x, outerCircle.y, outerCircle.radius);
      bgGradient.addColorStop(0, fgColor);
      bgGradient.addColorStop(0.35, bgColor);
      bgGradient.addColorStop(1, bgColor);
      bgBitmap.cls();
      bgBitmap.circle(outerCircle.x, outerCircle.y, outerCircle.radius, bgGradient);
    }

    // draw last frame at lower alpha for trails effect
    if (trailsEnabled) {
      trailBitmapSprite.bringToTop();
      var t = trailBitmapData;
      var o = offstageBitmapData;
      o.copy(t,0,0,t.width,t.height,0,0,t.width,t.height,0,0,0,1,1,fadeSpeed /* alpha */, blendMode, false);
      t.clear();
      t.draw(o);
      o.clear();
    }

    // draw current frame to buffer
    scene.children.forEach(function(swatch){
      if (trailsEnabled) { trailBitmapData.draw(swatch, swatch.x, swatch.y); }
    });

    // keep mansion on top
    mansion.bringToTop();

  }

  function render() {
    if (debugEnabled){
      var y=0, dy=32, c="#EEEEEE";
      game.debug.text( (game.time.fps || '--')+" fps", 32, y+=dy, c);
      game.debug.inputInfo(32, y+=dy, c);
    }    
  }

  var launchFireworkThrottled = throttle(_launchFirework,launchDelay);
  function launchFirework(target){
    launchFireworkThrottled(target);
  }
  function _launchFirework(target,auto){

    // if no swatchKeys yet, bail
    if (!swatchKeys) { return; }

    // choose random color
    var colorKeys = Object.keys(swatchesByColor);
    var color = colorKeys[Math.floor(Math.random()*colorKeys.length)];

    // create firework sprite at bottom center
    var firework = scene.create(game.world.width/2, game.world.height, "particle");
    firework.anchor.setTo(0.5, 0.5);
    firework.scale.x = firework.scale.y = 0.25;
    firework.tint = parseInt(color,16);
    fireworks.push(firework);

    // tween to target
    game.add.tween(firework).to({
      x: target.x,
      y: target.y
    }
    , auto?launchDuration:launchDurationManual // if on click, burst quickly
    , Phaser.Easing.Sinusoidal.In
    )
    .start()
    .onComplete.add(function(){

      // when firework reaches target, destroy firework and burst
      var burstRadius = random(burstRadiusMin,burstRadiusMax);
      var numSwatches = Math.round( random(particleMinCount,particleMaxCount) );

      firework.destroy();

      while (numSwatches--){

        // create burst particle
        (function(){

          var swatches = swatchesByColor[color];
          var swatchIndex = Math.floor(Math.random()*swatches.length*2);
          var swatchKey = swatchIndex>=swatches.length ? "particle" : swatches[swatchIndex];
          var swatchDuration = burstDuration + (Math.random()-0.5)*2*particleLifeVariance;

          var swatch = scene.create(firework.position.x, firework.position.y, swatchKey);
          swatch.anchor.setTo(0.5, 0.5);
          swatch.scale.x = swatch.scale.y = random(particleMinScale,particleMaxScale);
          swatch.rotation = random(0,2*Math.PI);

          // randomize burst particle path, simulating spherical shape
          var r = Math.sqrt(1.0 - Math.pow(Math.random(),2)) * burstRadius
            , theta = random(0,360)
            ;

          if (swatchKey==="particle"){ 
            // if non-swatch, tint and scale up
            swatch.tint=parseInt(color,16); 
            swatch.scale.x = swatch.scale.y = swatch.scale.x*2.0;
            r*=1.25;
          }
          game.add.tween(swatch).to({
            x: swatch.position.x + r*Math.cos(theta),
            y: swatch.position.y + r*Math.sin(theta),
          }
          , swatchDuration
          , Phaser.Easing.Exponential.Out
          )
          .start()
          .onComplete.add(function(){
            swatch.destroy();
          });

        })();

      }

    });

  }

  function resize() {
    var height = $(window).height();
    var width = $(window).width();
  
    game.width = width;
    game.height = height;
    game.stage.width = width;
    game.stage.height = height;

    trailBitmapData.resize(width,height);
    offstageBitmapData.resize(width,height);
    if (game.renderType === Phaser.WEBGL){
      game.renderer.resize(width, height);
    }

    if (mansion && innerCircle && outerCircle){
      mansion.x = innerCircle.x = outerCircle.x = game.world.width/2;
      mansion.y = innerCircle.y = outerCircle.y = game.world.height;
      bgBitmap.resize(game.world.width,game.world.height);
    }

  }

  function fullscreen() {
    if (game.scale.isFullScreen){
        game.scale.stopFullScreen();
    }else{
        game.scale.startFullScreen(false);
    }
  }

  function assignKeys(){
    var fullscreenKey, debugKey;
    // fullscreen
    fullscreenKey = game.input.keyboard.addKey(Phaser.Keyboard.F);
    fullscreenKey.onDown.add(fullscreen, this);
    // debug
    debugKey = game.input.keyboard.addKey(Phaser.Keyboard.D);
    debugKey.onDown.add(function(){ 
      debugEnabled = !debugEnabled; 
      game.time.advancedTiming = debugEnabled;
      game.debug.reset(); 
    }, this);
  }

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  function throttle( fn, delay, scope ){
      var to
          ,call = false
          ,args
          ,cb = function(){
              clearTimeout( to );
              if ( call ){
                  call = false;
                  to = setTimeout(cb, delay);
                  fn.apply(scope, args);
              } else {
                  to = false;
              }
          }
          ;
      scope = scope || null;
      return function(){
          call = true;
          args = arguments;
          if ( !to ){
              cb();
          }
      };
  }

});
