const download = require('download');
const fetch = require('node-fetch');
const fs = require('fs');

const modlist = require('./mods.json');
const versions = ["1.16.2", "1.16.3", "1.16.4", "1.16.5"];

// ooo colored text
const red = "\x1b[31m";
const yellow = "\x1b[33m";
const cyan = "\x1b[36m";
const green = "\x1b[32m";
const reset = "\x1b[0m";

var errors = 0;

var side = 'common';
//process.argv[2];
//const argv = yargs
//  .command('client', 'Download all client mods in mods.json', {
//      client: {
//          description: 'Download all client mods in mods.json',
//          alias: 'cl',
//          type: 'boolean',
//      }
//  })
//
//if(argv.client) {
//	var side = 'client';
//} else {
//	var side = 'server'
//}

// File path to download to
const path = './' + side + '/';

// Populate array with old mod files
var oldMods = [];

fs.readdirSync('./old/' + side).forEach(file => {
  oldMods.push(file);
});

/**
 * Represents a properties of a mod on Curseforge.
 * @constructor
 * @deprecated
 * @param  {String} display  Display name of the mod on the modlist.
 * @param  {String} name  Display name of the mod on Curseforge.
 * @param  {String} slug  Slug of the mod (serves as a text id for the mod on Curseforge). Used in Curseforge urls.
 * @param  {Int} id  Numerical id of the mod on Curseforge.
 */
function Mod(display, name, slug, id) {
  this.display = display,
  this.name = name,
  this.slug = slug,
  this.id = id
}

/**
 * Compares two arrays to see if they have any elements in common.
 * @param  {Array} array1  First array to compare.
 * @param  {Array} array2  Second array to compare.
 */
function match(array1, array2) {
  
  return array1.some(element => array2.includes(element))
}

/**
 * Attempts to download a mod object from Curseforge.
 * @param  {Mod} mod  Mod to download.
 * @param  {Function} callback  Callback function.
 */
function downloadMod(mod, callback) {

  // The ModIdGrabber will set the name to Project Not Found if the API didn't have it int their database before the switch (Jan 1st, 2020)
  if (mod.name != "Project Not Found" || mod.id != "N/A") {

    // Request mod data from the API and jsonify
    fetch("https://api.cfwidget.com/minecraft/mc-mods/" + mod.id + "?version=1.16").then(response => response.json()).then(data => {

      var file = data.download;

      // Ensure that the mod exists
      if (data.title == "Project Not Found") {

        console.log(red + "Mod " + mod.name + " not found!" + reset);
        errors++;

      // If it's the first time the link has been requested on the API, the script will have to be run again after the page has been loaded into it's database
      } else if (data.title == "Project is queued for fetch") {

        console.log(cyan + mod.display + " needs to be fetched! Please run this script again after its finished." + reset);
        errors++;

      // Make sure the download isn't Fabric
      } else if (file.versions.includes("Fabric") || file.name.toLowerCase().includes("fabric")) {

        console.log(yellow + "The download of " + mod.name + " is for Fabric! Please download the mod manually. (" + file.name + ")\n" + file.url.substr(0, file.url.length - 14) + reset);
        errors++;

      // Make sure that its for the right version
      } else if (!match(file.versions, versions)) {

        console.log(yellow + "Version mismatch for " + mod.name + "!\nDownload versions: " + file.versions + "\nAccepted versions: " + versions + "\n" + file.url.substr(0, file.url.length - 14) + reset)
        errors++;

      } else if (oldMods.includes(file.name)) {

        console.log(cyan + mod.display + " has had no version change. (" + file.name + ")" + reset);

      } else {

        console.log("Downloading " + mod.name + "... (" + file.name + ")");

        // The API will return a download object among other things, which contains the file name and a normal link to the latest download. The download id will be the last 7 digits of the link
        let downloadId = file.url.substr(file.url.length - 7, 7);

        // Construct the direct download link from the curseforge servers using this spec:
        // https://media.forgecdn.net/files/[first 4 digits of download id]/[next 3 digits of download id with zeros omitted until the first non-zero number]/[filename]
        let url = "https://media.forgecdn.net/files/" + downloadId.substr(0, 4) + "/" + downloadId.substr(4, 3).replace(/^0+/, '') + "/" + file.name;

        //console.log('========================\n' + file.url + '\n' + url + '\n========================'); // debug

        // Download using the direct link to the specified path; catch any errors
        download(url, path).catch((err) => {
          console.log(red + "Download for " + mod.name + " failed!\n" + err + reset);
          errors++;
        });
        
      }

      callback();

    });

  } else {

    console.log(cyan + mod.display + " has no id yet! Please set one in the mods list." + reset);
    errors++;

    callback(); // Make sure to still run the callback so the other mods can be downloaded

  }
  
};

/**
 * Downloads all mods in a given modlist.
 * @param  {Object} mods  Modlist (see modlist spec).
 * @param  {Int} index  Location in the list to start from
 */
function downloadMods(mods, index = 0) {

  // This callback will wait for the request from the API to resolve before moving on, effectively
  downloadMod(mods[index], () => {

    // Emulate a for loop using the lambda callback
    if (index < mods.length - 1) {

      downloadMods(mods, index + 1);

    }else {

      console.log(green + "========================\nMod downloads complete!" + reset);
      
      // Rename the files to replace %20 with a normal space
      console.log("Fixing file names...");
      var files = [];

      // Add the file names from directory
      fs.readdirSync(path).forEach(file => {
        files.push(file);
      });

      files.forEach(file => {
        fs.rename(path + file, path + file.replace(/%20/, ' '), err => {
          if (err) console.log('ERROR: ' + err);
        })
      });
      
      console.log("Complete!");
      console.log(errors + " error" + (errors != 1 ? "s" : "") + " occured.")
    }
  });

}

console.clear();
//console.log(argv.client);
console.log(green + "Beginning " + side +"-side mod download to " + path + "...\n========================" + reset);

switch (side) {
  case "common":
    downloadMods(modlist.mods.common);
    break;
  case "client":
    downloadMods(modlist.mods.client);
    break;
  case "server":
    downloadMods(modlist.mods.server);
    break;
  default:
    console.log(red + "Mod sidedness \"" + side + "\" is invalid! Must be client, common, or server");
}

// TODO: only update mods if the file name is actually different; refactor some code so the ONLY thing that downloadMod does is downloading mods; say getting the link
// also print filename next to mad name when downladoing