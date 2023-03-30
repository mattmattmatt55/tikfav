#! /usr/bin/env node

import { program } from "commander";
import dotenv from "dotenv";
import fetch from 'node-fetch'
import { readFileSync } from "fs";
import fs from 'fs';
import { pipeline } from "stream/promises";
import { openHistory } from "./history.js";

//commander setup
program
    .version('1.0.0')
    .name('TikFav')
    .option('-u <value>', 'choose user data file', 'user_data.json')
    .parse();

const opts = program.opts();
const userDataFile = opts.u;
console.log(opts.u)

//import dotenv file with API key
dotenv.config();

// API HTTP request template
const options = {
    method: 'POST',
    headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'X-RapidAPI-Key': process.env.APIKEY,
        'X-RapidAPI-Host': 'tiktok-video-no-watermark2.p.rapidapi.com'
    },
}
//read and parse user data file JSON and gets the list of Favorite Videos
try {
    var data = readFileSync(`./${userDataFile}`);
} catch (error) {
    //console.log("Error reading userdata file:", error);
    program.error("Couldn't read user data file, does it exist?");
}
try {
    const info = JSON.parse(data);
    let list = info["Activity"]["Favorite Videos"]["FavoriteVideoList"];

} catch (error) {
    program.error("Couldn't parse JSON data. Make sure you have chosen an unmodified TikTok data JSON file.")
}

// openHistory returns an array of strings containing all the URL's in the history file
let history = await openHistory();

//fetch video info from API
async function videoData(url) {
    // add the url to the query parameters
    const encodedParams = new URLSearchParams();
    encodedParams.append("url", url);
    encodedParams.append("hd", "1");
    // copy the options object with our API key and add the parameters as the body
    let fetchOptions = options;
    fetchOptions.body = encodedParams;

    // Make POST request using fetch, get JSON from response, and return the data
    const response = await fetch('https://tiktok-video-no-watermark2.p.rapidapi.com/', fetchOptions);
    var responseData = await response.json();
    // Log response status, calling function will handle errors
    console.log(response.status)
    return responseData;

}
/*
list.forEach(async vid => {        

    

});
*/
// open writeStream for history file
var writeHistory = fs.createWriteStream("history.txt", { flags: "a" });

for (let i = 0; i < 10; i++) {
    //get data from an entry in the Favorites list
    let favoriteVid = list[i];
    let favoriteURL = favoriteVid.Link;
    let vidDate = favoriteVid.Date;
    if (history.indexOf(favoriteURL) != -1) {
        console.log("Video was found in history file, skipping.")
        continue;
    }

    console.log("Now processing: " + favoriteURL)

    // get the video information from API and check for errors.
    // if the tiktok has been deleted, or there's another issue with the URL, it's logged and skipped
    var responseData = await videoData(favoriteURL);
    console.log(responseData)

    if (responseData.code != 0) {
        console.log('error saving video from URL ' + favoriteURL);
        continue;
    }
    // get the mp4 URL and metadata from the API response
    let vidURL = responseData.data.hdplay;
    let author = responseData.data.author.unique_id;
    let createTime = responseData.data.create_time;

    //fetch the video .MP4 from CDN
    let videoFile = await fetch(vidURL);

    //set filename and create a WriteStream
    let filename = `./${vidDate}_${author}_${createTime}.mp4`;
    let file = fs.createWriteStream(filename);
    //write the response body to a file
    await pipeline(videoFile.body, file);
    file.on('finish', () => {
        console.log(`finished writing video`);
        file.close();
    })
    // write URL to history file after download is finished
    writeHistory.write('\n' + favoriteURL, (error) => {
        console.log(error);
    })


}