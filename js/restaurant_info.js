let restaurant;
let params = (new URL(document.location)).searchParams;
const restaurant_id = params.get('id');
const reviewsUrl = "http://localhost:1337/reviews";
const restaurantUrl = "http://localhost:1337/restaurants/" + restaurant_id;
const favoriteUrl = "http://localhost:1337/restaurants/" + restaurant_id;
// const reviewsUrl = "";
var map;

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 16,
        center: restaurant.latlng,
        scrollwheel: false
      });
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    }
  });
}

window.addEventListener('load', function() {

  DBHelper.fetchRestaurantById(restaurant_id, (error, restaurant) => {
    self.restaurant = restaurant;
    const favorite = document.getElementById('favorite-checkbox');
    favorite.checked = restaurant.is_favorite;

  });
  //fetch(reviewsUrl + '/?restaurant_id=' + restaurant_id).then(function(){fetch(restaurantUrl)});
})

// Check for changes in the app's connection status

window.addEventListener("offline", function(e) {
    const title = 'Restaurant Reviews is offline';
    const options = {
      body: 'Submitted reviews will be uploaded \n when internet connection is restored.'
    };
    swRegistration.showNotification(title, options);
}, false);

window.addEventListener("online", function(e) {
    const title = 'Restaurant Reviews is back online!';
    const options = {
      body: 'You can now see updated restaurants \n and reviews information.'
    };
    swRegistration.showNotification(title, options);
    // When app goes back online, trigger the service worker's fetch event to update
    // restaurant and review data in IndexedDB
    fetch(reviewsUrl + '/?restaurant_id=' + restaurant_id).then(function(){
      DBHelper.fetchRestaurantById(restaurant_id, (error, restaurant) => {
        self.restaurant = restaurant;
        const favorite = document.getElementById('favorite-checkbox');
        console.log("Restaurant is favorite? ", restaurant.is_favorite);
        //favorite.checked = restaurant.is_favorite;
      });
    });
    
}, false);



/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  //if (self.restaurant) { // restaurant already fetched!
  //  callback(null, self.restaurant)
  //  return;
  //}
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      callback(null, restaurant)
    });
  }
}
function toggleFavorite(checked){
  fetch(favoriteUrl, {
    method: "PUT",
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    //make sure to serialize your JSON body
    body: JSON.stringify({
      is_favorite: checked
    })
  })
}

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name; // + ((restaurant.is_favorite)?' <span id="heart">&hearts;<span>':'');

  const favorite = document.getElementById('favorite-checkbox');
  favorite.checked = false; //restaurant.is_favorite;

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img'
  image.src = DBHelper.imageUrlForRestaurant(restaurant);

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  fillReviewsHTML();
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews = self.restaurant.reviews) => {

  const container = document.getElementById('reviews-container');
  const title = document.createElement('h2');
  title.setAttribute('tabindex', '0');
  title.innerHTML = 'Reviews!';
  container.appendChild(title);

  const paragraph = document.createElement('p');
  paragraph.innerHTML = 'Want to post your own review? Fill out the form below then click submit review!';
  paragraph.id = "review-instruction";
  container.appendChild(paragraph);


  // Create a form to add new review
  const reviewForm = document.createElement('form');
  reviewForm.method = "POST";
  reviewForm.action = reviewsUrl;
  //reviewForm.action = "";
  reviewForm.name = "myReview";
  reviewForm.id = "myReview";


  fldId = document.createElement('INPUT');
  fldId.type = 'HIDDEN';
  fldId.name = 'id';
  reviewForm.appendChild(fldId);


  fldRestaurantId = document.createElement('INPUT');
  fldRestaurantId.type = 'HIDDEN';
  fldRestaurantId.name = 'restaurant_id';
  fldRestaurantId.value = restaurant_id;
  reviewForm.appendChild(fldRestaurantId);


  fldLabel = document.createElement('LABEL');
  fldLabel.for = "rating";
  fldLabel.innerHTML = "Rating: ";
  reviewForm.appendChild(fldLabel);



  fldRating = document.createElement('INPUT');
  fldRating.type = 'NUMBER';
  fldRating.name = 'rating';
  fldRating.setAttribute('aria-label','Rating');
  fldRating.setAttribute('required',"");
  fldRating.min = 1;
  fldRating.max = 5;
  reviewForm.appendChild(fldRating);

  fldBr = document.createElement('BR');
  reviewForm.appendChild(fldBr);  


  fldLabel = document.createElement('LABEL');
  fldLabel.for = "name";
  fldLabel.innerHTML = "Name: ";
  reviewForm.appendChild(fldLabel);



  fldName = document.createElement('INPUT');
  fldName.type = 'TEXT';
  fldName.name = 'name';
  fldName.setAttribute('aria-label','Your name');
  fldName.setAttribute('required',"");
  fldName.value = '';
  reviewForm.appendChild(fldName);


  fldBr = document.createElement('BR');
  reviewForm.appendChild(fldBr);

  fldLabel = document.createElement('LABEL');
  fldLabel.for = "comments";
  fldLabel.innerHTML = "Review:";
  reviewForm.appendChild(fldLabel);


  fldComments = document.createElement('TEXTAREA');
  fldComments.name = 'comments';
  fldComments.setAttribute('aria-label','Your review');
  reviewForm.appendChild(fldComments);

  fldBr = document.createElement('BR');
  reviewForm.appendChild(fldBr);  

  fldButton = document.createElement('INPUT');
  fldButton.type = 'button';
  fldButton.value = 'Submit this review';
  fldButton.onclick = function(){
    let id = document.getElementsByName('id')[0].value;
    let name = document.getElementsByName('name')[0].value;
    let rating = document.getElementsByName('rating')[0].value;
    let comments = document.getElementsByName('comments')[0].value;
    let dateOptions = {year: 'numeric', month: 'long', day: 'numeric' };
    let date = (new Date()).toLocaleDateString('en-US', dateOptions);
    fetch(reviewsUrl, {
      method: "post",
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },

      //make sure to serialize your JSON body
      body: JSON.stringify({
        id: id,
        restaurant_id: restaurant_id,
        name: name,
        rating: rating,
        comments: comments
      })
    }).then((response) => {
      //console.log("Response --",JSON.stringify(await response.json()));
      DBHelper.fetchRestaurantById(restaurant_id, (error, restaurant) => {
        
        let reviewsList = document.getElementById('reviews-list');
        console.log('before:',reviewsList.innerHTML);
        reviewsList.innerHTML = "";
        console.log('Now:',reviewsList.innerHTML);
        console.log('After:',JSON.stringify(restaurant.reviews));


        let reviews = restaurant.reviews;
  
        document.getElementsByName('myReview')[0].reset();

        if (!reviews) {
          const noReviews = document.createElement('p');
          noReviews.innerHTML = 'No reviews yet!';
          container.appendChild(noReviews);
          return;
        }
        const ul = document.getElementById('reviews-list');
        reviews.sort(function(a,b){return (b.createdAt - a.createdAt) });
        reviews.forEach(review => {
          ul.appendChild(createReviewHTML(review));
        });
        container.appendChild(ul);


      });

       //do something awesome that makes the world a better place
    }).catch(function(e){
      console.log("Unable to save your review at this time. Your review will be posted soon.", e)
    });
  }

  reviewForm.appendChild(fldButton);
  fldBr = document.createElement('BR');
  reviewForm.appendChild(fldBr);  
  fldBr = document.createElement('BR');
  reviewForm.appendChild(fldBr);  
  container.appendChild(reviewForm);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.sort(function(a,b){return (b.createdAt - a.createdAt) });
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
}

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review) => {
  const li = document.createElement('li');
  const name = document.createElement('p');
  li.setAttribute('tabindex', '0');
  name.innerHTML = review.name;
  li.appendChild(name);

  const date = document.createElement('p');
  date.innerHTML = review.date;
  li.appendChild(date);

  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant=self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.setAttribute('tabindex', '0');
  li.setAttribute('aria-current', 'page');
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
}



/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
