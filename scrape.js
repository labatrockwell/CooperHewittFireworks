var https = require('https');
var fs = require('fs');
var chroma = require('chroma-js');
var cooperhewitt = require('node-cooperhewitt');



// arguments
var arg = 2
  , apiToken = process.argv[arg++]
  , apiColors = process.argv[arg++] || null
  , maxSwatches = process.argv[arg++] || 100
  , minObjects = process.argv[arg++] || 5
  , maxObjects = process.argv[arg++] || 10
  , maxConnections = process.argv[arg++] || 2
  ;

if (!apiToken){
  console.log("usage:\n  node scrape.js COOPER_HEWITT_API_TOKEN");
  return;
}

var swatches={}, colors=[], currentColor
  , requestInterval=100
  , rootDir="public/colors"
  , webRootDir="colors"
  , id=0
  ;

var assets = {
  "meta": {
      "generated": "1401380327373",
      "app": "cooperhewitt-fireworks",
      "url": "http://nickbartzokas.com",
      "version": "0.1",
      "copyright": "http://nickbartzokas.com"
  },
  "swatches":[]
};



// color selection
// define a "good" color as bright and colorful
var minSat=0.75 // minimum saturation
  , minLum=0.45 // minimum luminocity
  , maxLum=0.75 // maximum luminocity
  ;
function brightAndColorful(color){
  hsl = chroma(color).hsl();
  var good = hsl[1] > minSat && hsl[2] > minLum && hsl[2] < maxLum;
  return good;
}



// throttle connections to API (avoids "connect EMFILE" errors)
// to call it right away: (request(fn))();
// to pass it to something: Object.keys(objects).forEach( request(fn) );
// when request returns, call done()
function stopCondition(){
  return assets.swatches.length >= maxSwatches;
}
var requests = []
  , connections = 0
  ;
var requestHandler = setInterval(function(){
  if (stopCondition()){
    // console.log("Maximum swatches downloaded.");
    clearInterval(requestHandler);
  }
  if (connections<maxConnections){
    if (requests.length){
      connections++;
      var fn = requests.pop();
      fn();
    }
  }
},requestInterval);
function request(fn){
  if (stopCondition()){
    return null;
  }
  return function() {
    var context = this, args = arguments;
    requests.push(function(){
      fn.apply(context, args);
    });
  };
}
function done(){
  connections--;
}



//
// BEGIN REQUESTS
// 
if (apiColors){
  apiColors.split(",").forEach( request(requestCollections) );
}else{
  request(requestPalettes)();
}



function requestPalettes(){
  // console.log("requestPalettes()");

  cooperhewitt.call(
    'cooperhewitt.colors.palettes.getList', 
    {'access_token': apiToken}, 
    function(rsp){
      if (rsp.stat!=="ok") { console.error(rsp); return; }
      var palettes = rsp.palettes;
      Object.keys(palettes).forEach( request(requestColors) );
      done();
    });
}
function requestColors(palette){
  // console.log("requestColors("+palette+")");

  cooperhewitt.call(
  'cooperhewitt.colors.palettes.getInfo', 
  {
    'access_token': apiToken,
    'palette': palette
  }, 
  function(rsp){
    if (rsp.stat!=="ok") { console.error(rsp); return; }
    var colors = rsp.colors;

    var colorsKeys = Object.keys(colors)
      .sort(randomized) // randomize color load order
      .filter(brightAndColorful) // limit to bright and colorful colors
      ;

    colorsKeys.forEach( request(requestCollections) );
    done();

  });
}
function requestCollections(color){
  // console.log("requestCollections("+color+")");

  cooperhewitt.call(
  'cooperhewitt.search.collection', 
  {
    'access_token': apiToken,
    'color': color,
    'has_images': 1
  }, 
  function(rsp){
    if (rsp.stat!=="ok") { console.error(rsp); return; }
    var objects = rsp.objects;
    if (objects.length > minObjects && !swatches[color] ){
      objects.slice(0,maxObjects).forEach( request( curry(requestImages,color.replace('#','')) ) );
    }
    done();
  });
}
function requestImages(color,object){
  // console.log("requestImages("+color+","+object+")");

  cooperhewitt.call(
  'cooperhewitt.objects.getImages', 
  {
    'access_token': apiToken,
    'object_id': object.id
  }, 
  function(rsp){
    if (rsp.stat!=="ok") { console.error(rsp); return; }
    var images = rsp.images;

    if (images && images.length && images[0].sq && images[0].sq.url){

      if (!swatches[color]) { 
        swatches[color]=[]; 
        colors.push(color);
        if (!currentColor) { currentColor=colors[0]; }
      }

      // make root directory
      if (!fs.existsSync(rootDir)){
          fs.mkdirSync(rootDir);
      }
      // make color directory
      if (!fs.existsSync(rootDir+"/"+color)){
          fs.mkdirSync(rootDir+"/"+color);
      }
      // download image to color directory
      var imageUrl = images[0].sq.url;
      swatches[color].push(imageUrl);
      fs.mkdir(rootDir+"/"+color,function(){
        var fileUrl = rootDir+"/"+color+"/"+imageUrl.replace(/^.*[\\\/]/,"");
        var webFileUrl = webRootDir+"/"+color+"/"+imageUrl.replace(/^.*[\\\/]/,"");
        var file = fs.createWriteStream(fileUrl, '');
        var request = https.get(imageUrl, function(response) {
          response.pipe(file);

          console.log("Wrote: "+imageUrl);

          assets.swatches.push(
            { "type":"image"
            , "key":color+"_"+(id++)
            , "url":webFileUrl
            , "overwrite":false
            });

          fs.writeFile(rootDir+"/assets.json", JSON.stringify(assets, null, 2), function(err) {
            if(err) {
              console.log(err);
            }
          }); 

        });
      });

    }
    done();
  });
}
function curry(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    return function () {
        return fn.apply(this, args.concat(Array.prototype.slice.call(arguments)));
    };
}
function randomized(){
  return (Math.round(Math.random())-0.5);
}