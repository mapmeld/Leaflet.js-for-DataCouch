var map, po, currentData, geoJson, db;

// Should probably abstract out the couch url and the db prefix and the version and the starting map center.
var config = {
	dbPrefix: '',
	mapCenterLat: 42.3584308,
	mapCenterLon: -71.0597732,
	mapStartZoom: 14,
  db: "api", // relative vhost links defined in rewrites.json
  design: "ddoc",
  vhost: true,
  couchUrl: "",
  host: "http://" + window.location.href.split( "/" )[ 2 ],  
};

// vhosts are when you mask couchapps behind a pretty URL
function inVhost() {
  var vhost = false;
  if ( document.location.pathname.indexOf( "_design" ) === -1 ) {
    vhost = true;
  }
  return vhost;
}

function showLoader() {
  $('.map_header').first().addClass('loading');  
}

function hideLoader() {
  $('.map_header').first().removeClass('loading');  
}

function gotFirstDoc(data) {
  data = JSON.parse(data);
  // find the first non design doc
  var firstDoc = $(data.rows).map(function(i, r){
    if (r.id.indexOf("_design/") == -1) return r;
  })[0];
  
  $.get(config.host + config.couchUrl + "/api/" + firstDoc.id, function(moarData){
    moarData = JSON.parse(moarData);
    function getCoordinatesArray(obj){
      for(var key in obj) {
        if(key == "coordinates") {
          return obj[key];
        }
        if(typeof(obj) === 'object') {
          getCoordinatesArray(obj[key]);        
        }
      }
      return false;
    }
    function flatten(array){
      var flat = [];
      for (var i = 0, l = array.length; i < l; i++){
        var type = Object.prototype.toString.call(array[i]).split(' ').pop().split(']').shift().toLowerCase();
        if (type) { 
          flat = flat.concat(/^(array|collection|arguments|object)$/.test(type) ? flatten(array[i]) : array[i]); 
        }
      }
      return flat;
    }
    function getCoordinates(coordinates) {
      return flatten(coordinates);
    }
    var coordinates = getCoordinatesArray(moarData.geometry);
    var center = getCoordinates(coordinates);
    config.mapCenterLon = center[0];
    config.mapCenterLat = center[1];
    createMap(config);
  })
}

function createMap(config) {
  var llcenter = new L.LatLng( 1 * config.mapCenterLat, 1 * config.mapCenterLon);
  var startZoom = 1 * config.mapStartZoom;
  map = new L.Map('map_container', { center: llcenter, zoom: startZoom } );  
  geoJson = new L.GeoJSON();
  map.addLayer(geoJson);
  
  var featuresCache = {};

  var stamenUrl = 'http://tile.stamen.com/terrain/{z}/{x}/{y}.jpg';
    stamenAttribution = 'Map data &copy; 2012 OpenStreetMap contributors, Tiles courtesy Andy Allan';
    stamen = new L.TileLayer(stamenUrl, {maxZoom: 18, attribution: stamenAttribution});
	map.addLayer(stamen);

  /* var cloudmadeUrl = 'http://{s}.tile.cloudmade.com/d3394c6c242a4f26bb7dd4f7e132e5ff/998/256/{z}/{x}/{y}.png';
    cloudmadeAttribution = 'Map data &copy; 2012 OpenStreetMap contributors, Tiles from Cloudmade';
    cloudmade = new L.TileLayer(cloudmadeUrl, {maxZoom: 18, attribution: cloudmadeAttribution});
    map.addLayer(cloudmade); */

  showDataset();
}

var showDataset = function() {
  var bbox = getBB();
  showLoader();
  fetchFeatures( bbox, function( data ){
    data = JSON.parse(data);
    map.removeLayer(geoJson);
    geoJson = new L.GeoJSON();
    geoJson.on('featureparse', function(e){
      map.addLayer(e.layer);
      e.layer.bindPopup( '<div class="maptip"><div class="maptip-cnt"><div class="nub"></div><h2>properties</h2><p>' + formatMetadata(e.properties) + '</p></div></div>' );
  	})
    geoJson.addGeoJSON(data);
    hideLoader();
  })
}

function randomColor(colors) {
  var sick_neon_colors = ["#CB3301", "#FF0066", "#FF6666", "#FEFF99", "#FFFF67", "#CCFF66", "#99FE00", "#EC8EED", "#FF99CB", "#FE349A", "#CC99FE", "#6599FF", "#03CDFF"];
  return sick_neon_colors[Math.floor(Math.random()*sick_neon_colors.length)];
};

function fetchFeatures(bbox, callback) {
  $.ajax({
    url: config.couchUrl + "data",
    data: {
      "bbox": bbox
    },
    success: callback
  });
}

var getBB = function(){
  var extent = map.getBounds();
  return extent.getSouthWest().lng + "," + extent.getSouthWest().lat + "," + extent.getNorthEast().lng + "," + extent.getNorthEast().lat;
}

var formatMetadata = function(data) {
  out = '<dl>';
  $.each(data, function(key, val) {
    if (typeof(val) == 'string' && key[0] != '_') {
      out = out + '<dt>' + key + '<dd>' + val;
    } else if (typeof(val) == 'object' && key != "geometry" && val != null) {
      if (key == 'properties') {
        $.each(val, function(attr, value){
          out = out + '<dt>' + attr + '<dd>' + value;
        })
      } else {
        out = out + '<dt>' + key + '<dd>' + val.join(', ');
      }
    }
  });
  out = out + '</dl>';
  return out;
}

$(function(){  
  if ( !inVhost() ) {
    var cfg = config;
    cfg.vhost = false
    cfg.db = document.location.href.split( '/' )[ 3 ];
    cfg.design = unescape( document.location.href ).split( '/' )[ 5 ];
    cfg.couchUrl = "/" + cfg.db + "/_design/" + cfg.design + "/_rewrite/";
  }

  $.get( config.host + config.couchUrl + "/api/_all_docs?limit=10", gotFirstDoc); 
});