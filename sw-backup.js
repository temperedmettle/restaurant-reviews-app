
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
function createDB() {
	/**
	* Merge restaurant and reviews data then store it to IndexedDB.
	*/
	var restaurantsJson = {};
	fetch('http://localhost:1337/restaurants')
		.then(function(restaurantResponse) {
	  		console.log('Returning restaurants data...'); 
	    	return restaurantResponse.json();
		})
		.then(function(restaurantsJson) {
	  		fetch('http://localhost:1337/reviews')
	  			.then(function(responseReviews) {
	  				responseReviews.json().then(function(reviewsJson){
		  				var restaurantArray = new Array();
		  				for (var restaurant of restaurantsJson){
		  					reviewItems = reviewsJson.filter(obj => {return obj.restaurant_id == restaurant.id});
		  					var dateOptions = {year: 'numeric', month: 'long', day: 'numeric' };
		  					for (const idx of reviewItems.keys()){
		  						reviewItems[idx].date = (new Date(reviewItems[idx].createdAt)).toLocaleDateString('en-US', dateOptions);  						
		  					}
		  					restaurant.reviews = reviewItems;
		  					restaurantArray.push(restaurant);
		  				}
		  				return restaurantArray; 	  					
	  				})
		  			.then(function(updatedRestaurants){
						dbPromise = idb.open('restaurant-reviews', 2, upgradeDB => {
							console.log('Creating IndexedDb');
						 	var restaurantStore = upgradeDB.createObjectStore('restaurants', {keyPath:'id'});
						  	for (var restaurant of updatedRestaurants) {
						  		restaurantStore.put({
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
						  			updatedAt: restaurant.updatedAt,
						  			is_favorite: restaurant.is_favorite
						  		});	
						  	}
						});
		  			})
	  			})
	    	console.log('IDB database created...');
		})


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
  	createDB()
  );
});

self.addEventListener('fetch', function(event) {
  // If url points to the restaurants API
  // retrieve data from IndexedDB.

	if (event.request.url.includes('/restaurants')) {
		event.respondWith(

			idb.open('restaurant-reviews', 2).then(function(db) {
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

