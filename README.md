###### The LAB at Rockwell Group's
# Cooper Hewitt Collection Fireworks

![Fireworks](./README/fireworks.gif)

Fireworks generated from images found in the Cooper Hewitt collection.

# To install and run 
1. Go get a [Cooper Hewitt API Token](https://collection.cooperhewitt.org/api/)
- Install node dependencies by running:
	
	`npm install`
- Download Cooper Hewitt collection images by running:

	`node scrape.js COOPER-HEWITT-API-TOKEN`
- Launch the project server:

	`node server.js`
- Navigate to `http://localhost:8000/public`
- Click to make fireworks