
if (typeof idb === "undefined") {
    self.importScripts('js/idb.js');
}
const DB_VERSION = 2;
const API_URL = "http://localhost:1337/";
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
async function putRestaurantsAndReviews (restaurantsJson, restaurantStore) {
 	urls = Array();
 	var reviews = new Array();

	for (var restaurant of restaurantsJson) {

			// Store restaurant data
  		restaurantStore.put({
  			id: restaurant.id, 
  			name: restaurant.name,
  			neighborhood: restaurant.neighborhood,
  			photograph: restaurant.photograph,
  			address: restaurant.address,
  			latlng: restaurant.latlng,
  			cuisine_type: restaurant.cuisine_type,
  			operating_hours: restaurant.operating_hours,
  			createdAt: restaurant.createdAt,
  			updatedAt: restaurant.updatedAt,
  			is_favorite: restaurant.is_favorite
  		});
  		// Get the review urls for each restaurant
  		urls.push(API_URL + 'reviews/?restaurant_id=' + restaurant.id);
	}

	// Use async/await to fetch all review urls and save json results to array 
	const reviewsJson = urls.map(async function(url){
		const response = await fetch(url);
		return response.json();
	});
	for (const reviewSet of reviewsJson) {
		for (let reviewItem of (await reviewSet)){
			reviews.push(reviewItem);
		}
	}

		// Store review data
	idb.open('restaurant-reviews', DB_VERSION).then(function(db){
		var reviewTx = db.transaction('reviews', 'readwrite');
	 	var reviewStore = reviewTx.objectStore('reviews');
	 	var dateOptions = {year: 'numeric', month: 'long', day: 'numeric' };
		for (let idx of reviews.keys()) {
			reviews[idx].date = (new Date(reviews[idx].createdAt)).toLocaleDateString('en-US', dateOptions);
	  		reviewStore.put({
	  			id: reviews[idx].id,
	  			restaurant_id: parseInt(reviews[idx].restaurant_id),
	  			name: reviews[idx].name,
	  			createdAt: new Date(reviews[idx].createdAt).getTime(),
	  			updatedAt: new Date(reviews[idx].updatedAt).getTime(),
	  			date: reviews[idx].date,
	  			rating: parseInt(reviews[idx].rating),
	  			comments: reviews[idx].comments
	  		});
		}							 								
	})	

}

function createDB() {
	/**
	* Merge restaurant and reviews data then store it to IndexedDB.
	*/

 	fetch(API_URL + 'restaurants').then(function(restaurantResponse){
 		restaurantResponse.json().then(function(restaurantsJson){
			idb.open('restaurant-reviews', DB_VERSION, async upgradeDB => {
			 	let restaurantStore = upgradeDB.createObjectStore('restaurants', {keyPath:'id'});
			 	let reviewStore = upgradeDB.createObjectStore('reviews', {keyPath:'id', autoIncrement:true});
			 	reviewStore.createIndex('restaurant_id', 'restaurant_id', {unique: false});
			 	let unsavedStore = upgradeDB.createObjectStore('unsaved', {keyPath:'id', autoIncrement:true});
			 	unsavedStore.createIndex('restaurant_id', 'restaurant_id', {unique:false});
			 	putRestaurantsAndReviews(restaurantsJson, restaurantStore);
	 		})
 		})
 	})
	console.log('IDB database created...');
}

self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME).then( cache => {
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

self.addEventListener('fetch',function(event) {

	// If url points to the restaurants API
	// retrieve data from IndexedDB.
	let request = event.request.clone();
	let method = request.method;
	let url = request.url;



	
	if (url.includes('/restaurants')) {
		
		let reviews = new Array();
		if 	(url.includes('/restaurants/')){
			if (method=='PUT') {

				let requestJson = request.json();
				event.respondWith(
					// Call API to toggle favorites
					fetch(event.request).catch(async error => {


						let jsonData = await requestJson;

						let restaurant_id = parseInt(request.url.slice(request.url.lastIndexOf('/') + 1));
						
						const dateOptions = {year: 'numeric', month: 'long', day: 'numeric' };
						jsonData.createdAt = new Date().getTime();
						jsonData.date = (new Date()).toLocaleDateString('en-US', dateOptions);
						body = JSON.stringify(jsonData);
						let pending = Array();
						idb.open('restaurant-reviews', DB_VERSION).then(async db => {

							let unsavedTx = db.transaction('unsaved','readwrite');
							let unsavedStore = unsavedTx.objectStore('unsaved');
							pending = unsavedStore.getAll();


							
							let data = {
								url: url,
								restaurant_id: parseInt(restaurant_id),
								body: body
							}
							await unsavedStore.put(data);

							let restaurantTx = db.transaction('restaurants', 'readwrite');				
							let restaurantStore = restaurantTx.objectStore('restaurants');
							let restaurant = await restaurantStore.get(restaurant_id);
							restaurant.is_favorite = jsonData.is_favorite;
							restaurantStore.put(restaurant);

						});

					})	
				);
			}
			
		} else { // URL does not include "/restaurants/"
			event.respondWith(

				idb.open('restaurant-reviews', DB_VERSION).then(async function(db) {
					
				 	fetch(API_URL + 'restaurants').then(function(restaurantResponse){
				 		restaurantResponse.json().then(function(restaurantsJson){
				 			let restaurantTx = db.transaction('restaurants','readwrite');
						 	let restaurantStore = restaurantTx.objectStore('restaurants');
						 	putRestaurantsAndReviews(restaurantsJson, restaurantStore);
				 		});
				 	}).catch(function(error){console.log("Error fetching restaurants")});
				 	
					let restaurantTx = db.transaction('restaurants', 'readonly');				
					let restaurantStore = restaurantTx.objectStore('restaurants');
					let restaurants = await restaurantStore.getAll();

					// Add associated reviews to restaurant objects
					for (let idx of restaurants.keys()) {

						let restaurant_id = restaurants[idx].id;
						let reviewsTx = db.transaction('reviews', 'readonly');
						let reviewStore = reviewsTx.objectStore('reviews');
						let	reviewIndex = reviewStore.index('restaurant_id');					
						reviews = await reviewIndex.getAll(restaurant_id);

						let unsavedTx = db.transaction('unsaved','readwrite');
						let unsavedStore = unsavedTx.objectStore('unsaved');
						let unsavedIndex = unsavedStore.index('restaurant_id');
						let pendingRequests = unsavedIndex.getAll(restaurant_id);
						for (let request of await pendingRequests) {
							body = JSON.parse(request.body);
							if (request.url.includes('reviews')){
								reviews.push(body);	
							}
							
						}					
						restaurants[idx].reviews = reviews.sort(function(a,b){return (b.createdAt - a.createdAt) })
					}
					return restaurants;
				}).then(function(items) {
					console.log('Passing db data...');
					var myBody = new Blob([JSON.stringify(items, null, 2)], {type : 'application/json'});
					return new Response(myBody, {
					  	headers: { "Content-Type" : "application/json" }
					})
				})
			);
		}	
	} else if (event.request.url.includes('/reviews')) {


		
		
		var reviews;
		if (method == 'GET'){
			const params = (new URL(url)).searchParams;
			const restaurant_id = params.get('restaurant_id');				
			event.respondWith(

				
				idb.open('restaurant-reviews', DB_VERSION).then(async db => {

					let unsavedTx = db.transaction('unsaved','readwrite');
					let unsavedStore = unsavedTx.objectStore('unsaved');
					pendingRequests = unsavedStore.getAll();
					let requestObjects = Array();

					for (requestItem of await pendingRequests) {
						let id = requestItem.id;
						let url = requestItem.url;
						let body = requestItem.body;

						requestObjects.push({
							'id':id,
							'request': new Request(url, {
							    	method: "POST",
							    	headers: {
							    		'Accept': 'application/json',
							        	'Content-Type': 'application/json'
							      	},
							      	body: body
							})
						});						
					}
					const requestsJson = requestObjects.map(async function(requestObject){
						await fetch(requestObject.request).then(function(response){
							
							unsavedTx = db.transaction('unsaved','readwrite');
							unsavedStore = unsavedTx.objectStore('unsaved');
							unsavedStore.delete(requestObject.id);
						});
					});
				

					// Refresh database and reviews object stores
				 	await fetch(API_URL + 'restaurants').then(function(restaurantResponse){
				 		restaurantResponse.json().then(function(restaurantsJson){
				 			let restaurantTx = db.transaction('restaurants','readwrite');
						 	let restaurantStore = restaurantTx.objectStore('restaurants');
						 	putRestaurantsAndReviews(restaurantsJson, restaurantStore);
				 		})
				 	})

				 	// Get reviews for current restaurant
					let reviewTx = db.transaction('reviews','readwrite');
					let reviewStore = reviewTx.objectStore('reviews');		
					let	reviewIndex = reviewStore.index('restaurant_id');
					
					reviews = await reviewIndex.getAll(parseInt(restaurant_id));
					reviews.sort(function(a,b){return (b.createdAt - a.createdAt) });

					return ( new Response(new Blob([JSON.stringify(reviews, null, 2)], {type : 'application/json'}), {
				  		headers: { "Content-Type" : "application/json" }
					}))											
				})
			);
		
		} else { // method is post
			let requestJson = request.json();
			event.respondWith(

				fetch(event.request).then(async response => {

					let jsonData = response.json();
				
					//return updateReviews(jsonData);
					let body = await jsonData;
					
					let restaurant_id = parseInt(body.restaurant_id);
					idb.open('restaurant-reviews', DB_VERSION).then(async db => {
						const dateOptions = {year: 'numeric', month: 'long', day: 'numeric' };
						let reviewTx = db.transaction('reviews', 'readwrite');
					 	let reviewStore = reviewTx.objectStore('reviews');
					 	let	reviewIndex = reviewStore.index('restaurant_id');
						let date = (new Date(body.createdAt)).toLocaleDateString('en-US', dateOptions);
						data = {
				  			id: body.id,
				  			restaurant_id: restaurant_id,
				  			name: body.name,
				  			createdAt: new Date(body.createdAt).getTime(),
				  			updatedAt: new Date(body.updatedAt).getTime(),
				  			date: date,
				  			rating: parseInt(body.rating),
				  			comments: body.comments
				  		}
				  		await reviewStore.put(data);	
						reviews = await reviewIndex.getAll(restaurant_id);
						reviews.sort(function(a,b){return (b.createdAt - a.createdAt) });

					})
					return ( new Response(new Blob([JSON.stringify(reviews, null, 2)], {type : 'application/json'}), {
				  		headers: { "Content-Type" : "application/json" }
					}))

					
				}).catch(async error => {
					

					let jsonData = await requestJson;
					const dateOptions = {year: 'numeric', month: 'long', day: 'numeric' };
					jsonData.createdAt = new Date().getTime();
					jsonData.date = (new Date()).toLocaleDateString('en-US', dateOptions);
					body = JSON.stringify(jsonData);
					//let pending = Array();
					idb.open('restaurant-reviews', DB_VERSION).then(async db => {

						let unsavedTx = db.transaction('unsaved','readwrite');
						let unsavedStore = unsavedTx.objectStore('unsaved');
						//pending = unsavedStore.getAll();

						let data = {
							url: url,
							restaurant_id: parseInt(jsonData.restaurant_id),
							body: body
						}
						await unsavedStore.put(data);
						let reviewTx = db.transaction('reviews','readwrite');
						let reviewStore = reviewTx.objectStore('reviews');		
						let	reviewIndex = reviewStore.index('restaurant_id');
						reviews = await reviewIndex.getAll(parseInt(jsonData.restaurant_id));

						reviews.sort(function(a,b){return (b.createdAt - a.createdAt) });
					});

					return ( new Response(new Blob([JSON.stringify(reviews, null, 2)], {type : 'application/json'}), {
				  		headers: { "Content-Type" : "application/json" }
					}))
				})	
			);
		}

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

