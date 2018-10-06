
if (typeof idb === "undefined") {
    self.importScripts('js/idb.js');
}


var CACHE_NAME = 'restaurant-reviews-app-cache-v1';
var urlsToCache = [
  '/',
  '/css/styles.css',
  '/js/dbhelper.js',
  '/js/main.js',
  '/js/idb.js',
  '/js/restaurant_info.js',
  '/img/1.jpg',
  '/img/2.jpg',
  '/img/3.jpg',
  '/img/4.jpg',
  '/img/5.jpg',
  '/img/6.jpg',
  '/img/7.jpg',
  '/img/8.jpg',
  '/img/9.jpg',
  '/img/10.jpg',
  '/img/unavailable.jpg'
];

let dbPromise = Promise;
function createDB(myJson) {
	dbPromise = idb.open('restaurant-reviews', 1, upgradeDB => {
	  console.log('Creating IndexedDb');
	  var store = upgradeDB.createObjectStore('restaurants', {keyPath:'id'});
	  for (var restaurant of myJson) {
	  	store.put({
	  		id: restaurant.id, 
	  		name: restaurant.name,
	  		neighborhood: restaurant.neighborhood,
	  		photograph: restaurant.photograph,
	  		address: restaurant.address,
	  		latlng: restaurant.latlng,
	  		cuisine_type: restaurant.cuisine_type,
	  		operating_hours: restaurant.operating_hours,
	  		reviews: restaurant.reviews,
	  		createdAt: restaurant.createdAt,
	  		updatedAt: restaurant.updatedAt

	  	});	
	  }

	  
	});
}

function getDbItem(key) {
	return dbPromise.then(db => {
		return db.transaction('restaurant-reviews')
			.objectStore('restaurants').get(key);
	})
}

function setDbItem(key, val) {
    return dbPromise.then(db => {
      const tx = db.transaction('restaurant-reviews', 'readwrite');
      tx.objectStore('restaurants').put(val, key);
      return tx.complete;
    });
}


self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then( cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })


  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
	fetch('http://localhost:1337/restaurants')
	  .then(function(response) {
	  	console.log('Returning json file...');
	    return response.json();
	  })
	  .then(function(myJson) {
	    createDB(myJson);
	    console.log('IDB database created...');
	  })

  );
});

self.addEventListener('fetch', function(event) {
  // If url points to the restaurants API
  // retrieve data from IndexedDB.

	if (event.request.url.includes('/restaurants')) {
		event.respondWith(
			dbPromise.then(function(db) {
				var tx = db.transaction('restaurants', 'readonly');
				var store = tx.objectStore('restaurants');
				return store.getAll();
			}).then(function(items) {
				console.log('Passing db data...');

				var myBody = new Blob([JSON.stringify(items, null, 2)], {type : 'application/json'});
		

				return new Response(myBody, {
				  	headers: { "Content-Type" : "application/json" }
				})
			})
		);	
	} else { 
  // Load resources from the cache if available, otherwise fetch it from
  // the network then store it in the cache.		
		event.respondWith(
		  	caches.open(CACHE_NAME).then(function(cache) {
		  		return cache.match(event.request).then(function (response) {
		        	return response || fetch(event.request).then(function(response) {
		        		cache.put(event.request, response.clone());
		        		return response;
		        	});
		    	});
		  	})
		);
	}


});

