const fs = require('fs');
const fetch = require('node-fetch');
const path = require('path');

const express = require('express');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

console.log('------- STEAM -------')

//////////////////////////////
//////     DB UPDATE

// Get game list from JSON file
const data = fs.readFileSync(`${__dirname}/dev-data/data.json`, 'utf-8');
const dataObj = JSON.parse(data);

// Get game stats data from JSON file
const statsDir = fs.readFileSync(`${__dirname}/dev-data/stats.json`);
let stats = JSON.parse(statsDir);

const setData = function() {
  const checkedOn = new Date();
  const seconds = checkedOn.getSeconds() < 10 ? '0' + checkedOn.getSeconds() : checkedOn.getSeconds();
  const minutes = checkedOn.getMinutes() < 10 ? '0' + checkedOn.getMinutes() : checkedOn.getMinutes();
  const hours = checkedOn.getHours() < 10 ? '0' + checkedOn.getHours() : checkedOn.getHours();
  const time = `${hours}:${minutes}:${seconds}`;

  const day = checkedOn.getDate() < 10 ? '0' + checkedOn.getDate() : checkedOn.getDate();
  const month = checkedOn.getMonth() < 10 ? '0' + checkedOn.getMonth() : checkedOn.getMonth();
  const year = checkedOn.getFullYear();
  const date = `${day}-${month}-${year}`;


  dataObj.forEach((game, i) => {
    fetch(`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?key=1D6A378BA2086E331165352523F854E2&appid=${game.steamId}`)
    .then(response => response.json())
    .then(data => {
      if(stats[i]) {
        stats[i].unshift({
          players: data.response.player_count,
          date,
          time
        }
          );
        if(stats[i][60]) {
          stats[i].splice(60, 3);
        }
      } else {
        stats[i] = [];
        stats[i][0] = {
          players: data.response.player_count,
          date,
          time
        }
      } 
    })
    .catch(error => console.log('Steam Error')) 
  })
  let statsFile = JSON.stringify(stats);
  fs.writeFileSync(`${__dirname}/dev-data/stats.json`, statsFile);
}

const interval = 1000 * 60 * 5//Interval
setTimeout(setData, 1000 * 10); // Get data on start
setInterval(setData, interval);

// Get Global Bestsellers

// Get global postition data from JSON file
const gposDir = fs.readFileSync(`${__dirname}/dev-data/gpos.json`);
let gpos = JSON.parse(gposDir);

const getGlobalPos = function() {
  const newGlobal = [];
  const checkedOn = new Date();
  const seconds = checkedOn.getSeconds() < 10 ? '0' + checkedOn.getSeconds() : checkedOn.getSeconds();
  const minutes = checkedOn.getMinutes() < 10 ? '0' + checkedOn.getMinutes() : checkedOn.getMinutes();
  const hours = checkedOn.getHours() < 10 ? '0' + checkedOn.getHours() : checkedOn.getHours();
  const time = `${hours}:${minutes}:${seconds}`;


  function task(i) {
    setTimeout(function() {
      fetch(`https://store.steampowered.com/search/?os=win&filter=globaltopsellers&page=${i}`)
    .then((response) => {
      return response.text();
    })
    .then((data) => { 

      dataObj.forEach((game) => {
        const isOnPage = data.includes(game.steamId);
      
        if(isOnPage) {

          /*
          let dataChunks = data.split(game.steamId);
          const count = ((dataChunks[0].match(/data-ds-appid/g) || []).length) + 1;
          console.log(game.gameName, ' is: ', count, ' on page: ', i);
          */

          if(!newGlobal[game.id]) {
            newGlobal[game.id] = {
              page: [i],
              time,
              };
          } else {
            newGlobal[game.id].page.push(i);
          }
        }
      })

    }).catch(error => console.log(`Steam Error page: ${i}`))
    }, 100 * i)
  }

  for(let i=1; i<900; i++) {
    task(i);
  }

  const checkArray = () => {
    dataObj.forEach(game => {
      if(newGlobal[game.id]) {

        newGlobal[game.id].page.sort((a,b) => a - b);



        if(gpos[game.id]) {
          gpos[game.id].unshift(newGlobal[game.id]);
          if(gpos[game.id][60]){
            gpos[game.id].splice(60,3);
          }
        } else {
          gpos[game.id] = [];
          gpos[game.id][0] = newGlobal[game.id];
        }
      }
    })
    
    let gposFile = JSON.stringify(gpos);
    fs.writeFileSync(`${__dirname}/dev-data/gpos.json`, gposFile);
    console.log('GPOS updated');
  }
  setTimeout(checkArray, 1000 * 150);
}

const interval2 = 1000 * 60 * 20 //Interval
setTimeout(getGlobalPos, 1000 * 60); // Get data on start

function getPosInit() {
  setInterval(getGlobalPos, interval2)
}
setTimeout(getPosInit, 1000 * 60 * 2);


//////////////////////////////
//////     SERVER

const tempApp = fs.readFileSync(`${__dirname}/templates/App.html`, 'utf-8');
const tempHomeContent = fs.readFileSync(`${__dirname}/templates/homeContent.html`, 'utf-8');
const tempGameContent = fs.readFileSync(`${__dirname}/templates/gameContent.html`, 'utf-8');
const tempNavGame = fs.readFileSync(`${__dirname}/templates/navGame.html`, 'utf-8');

const replaceTemplate = (temp, game) => {
  
  let output = temp.replace(/{%GAME_TITLE%}/g, game.gameName);
  output = output.replace(/{%PLAYERS_COUNT_NOW%}/g, stats[game.id][0].players);
  output = output.replace(/{%IMG_NAME%}/g, game.imgName);
  output = output.replace(/{%IMG_ALT%}/g, game.imgAlt);
  output = output.replace( /{%ID%}/g, game.id);

  return output;
}

app.get('/', (req, res) => {
  const navGamesHtml = dataObj.map(el => replaceTemplate( tempNavGame , el)).join('');
  let output = tempApp.replace('{%NAV_GAMES%}', navGamesHtml);
  output = output.replace('{%MAIN_CONTENT%}', tempHomeContent)
  output = output.replace('{%GAMES_IN%}', dataObj.length)

  const popularToSort = dataObj.map((game, id) => {
    try {
      const popularItem = [stats[id][0].players, id]
      return popularItem;
    } catch(err) {
      const popularItem = [0, id]
      return popularItem;
    }
    
  })
  const popularSorted = popularToSort.sort((a,b) => {
    return b[0] - a[0];
  });

  
  const bestsellersToSort = dataObj.map((game, id) => {
    try {
      const bestsellerItem = [gpos[id][0].page[0], id]
      return bestsellerItem;
    } catch(err) {
      const bestsellerItem = [999, id]
      return bestsellerItem;
    }
  })

  const bestsellersSorted = bestsellersToSort.sort((a,b) => {
    return a[0] - b[0];
  });

  for(let i = 1; i <= 5; i++) {
    output = output.replace(`{%GAME_TITLE_${i}%}`, dataObj[popularSorted[i-1][1]].gameName);
    output = output.replace(`{%IMG_NAME_${i}%}`, dataObj[popularSorted[i-1][1]].imgName);
    output = output.replace(`{%IMG_ALT_${i}%}`, dataObj[popularSorted[i-1][1]].imgAlt);
    output = output.replace(`{%PLAYERS_COUNT_NOW_${i}%}`, popularSorted[i-1][0]);
    output = output.replace(`{%ID_${i}%}`, dataObj[popularSorted[i-1][1]].id);

    output = output.replace(`{%B_GAME_TITLE_${i}%}`, dataObj[bestsellersSorted[i-1][1]].gameName);
    output = output.replace(`{%B_IMG_NAME_${i}%}`, dataObj[bestsellersSorted[i-1][1]].imgName);
    output = output.replace(`{%B_IMG_ALT_${i}%}`, dataObj[bestsellersSorted[i-1][1]].imgAlt);
    output = output.replace(`{%BEST_PAGE_${i}%}`, bestsellersSorted[i-1][0]);
    output = output.replace(`{%B_ID_${i}%}`, dataObj[bestsellersSorted[i-1][1]].id);
  }

  res.send(output);
})

app.get('/game', (req, res) => {
  const navGamesHtml = dataObj.map(el => replaceTemplate( tempNavGame , el)).join('');
  let output = tempApp.replace('{%NAV_GAMES%}', navGamesHtml);

  let id = parseInt(req.query.id);
  if(id >= dataObj.length || id < 0 || Number.isNaN(id)) {
    output = output.replace('{%MAIN_CONTENT%}', '<h2 style="margin:auto; letter-spacing:4px; font-weight: 300; font-size: 30px;">STRONA NIE ISTNIEJE</h2>');
    res.send(output);
    return;
  }
  


  let gameContentHtml = tempGameContent.replace('{%GAME_TITLE%}', dataObj[id].gameName);
  gameContentHtml = gameContentHtml.replace('{%PRODUCENT%}', dataObj[id].producer);
  gameContentHtml = gameContentHtml.replace('{%PUBLISHER%}', dataObj[id].publisher);

  let oldPlayersNr;
  let newPlayersNr;
  
  function getPlayers(i){
    
    try {
    gameContentHtml = gameContentHtml.replace(`{%PLAYERS_NR_${i}%}`,
    stats[id][i].players);
    } catch(err) {
    gameContentHtml = gameContentHtml.replace(`{%PLAYERS_NR_${i}%}`,
    'brak danych');
    }
    try {
    gameContentHtml = gameContentHtml.replace(`{%PLAYERS_DATE_${i}%}`,
    stats[id][i].time);
    } catch(err) {
    gameContentHtml = gameContentHtml.replace(`{%PLAYERS_DATE_${i}%}`,
    'brak danych'); 
    }

    try {
      newPlayersNr = stats[id][i].players;
    
    
      if(oldPlayersNr && (newPlayersNr - oldPlayersNr) > 0) {
        gameContentHtml = gameContentHtml.replace(`{%PLAYERS_STYLE_${i-1}%}`,
        'color: red');
      } else if (oldPlayersNr && (newPlayersNr - oldPlayersNr) < 0){
        gameContentHtml = gameContentHtml.replace(`{%PLAYERS_STYLE_${i-1}%}`,
        'color:green');
      } else {
        gameContentHtml = gameContentHtml.replace(`{%PLAYERS_STYLE_${i-1}%}`,
        '');
      }

    oldPlayersNr = newPlayersNr;
    } catch(err) {
      gameContentHtml = gameContentHtml.replace(`{%PLAYERS_STYLE_${i-1}%}`,
        '');
    }
    
  };

  for(let i=0; i <= 18; i++) {
    getPlayers(i);
  }
  

 let oldGposNr;
 let newGposNr;
  for(let i=0; i <= 17; i++) {
    try{
    let globalPosition = gpos[id][i].page[0];
    globalPosition = `${globalPosition} (#${(gpos[id][i].page[0] * 25) - 24} - ${(gpos[id][i].page[0] * 25)})`;
    gameContentHtml = gameContentHtml.replace(`{%BPOS_NR_${i}%}`, globalPosition);
    } catch(err) {
    gameContentHtml = gameContentHtml.replace(`{%BPOS_NR_${i}%}`, 'brak danych');
    }
    
    try {
    gameContentHtml = gameContentHtml.replace(`{%BPOS_TIME_${i}%}`, gpos[id][i].time);
    } catch(err) {
    gameContentHtml = gameContentHtml.replace(`{%BPOS_TIME_${i}%}`, 'brak danych'); 
    }
  
    try {
    newGposNr = gpos[id][i].page[0];
      if(oldGposNr && (newGposNr - oldGposNr) > 0) {
        gameContentHtml = gameContentHtml.replace(`{%BPOS_STYLE_${i-1}%}`,
        'color: green');
      } else if (oldGposNr && (newGposNr - oldGposNr) < 0){
        gameContentHtml = gameContentHtml.replace(`{%BPOS_STYLE_${i-1}%}`,
        'color:red');
      } else {
        gameContentHtml = gameContentHtml.replace(`{%BPOS_STYLE_${i-1}%}`,
        '');
      }

    oldGposNr = newGposNr;
    } catch(err) {
      gameContentHtml = gameContentHtml.replace(`{%BPOS_STYLE_${i-1}%}`,
        '');
    }
  }
  

  output = output.replace('{%MAIN_CONTENT%}', gameContentHtml)
  res.send(output);
})

app.use(function(req, res, next) {
    
    const navGamesHtml = dataObj.map(el => replaceTemplate( tempNavGame , el)).join('');
    let output = tempApp.replace('{%NAV_GAMES%}', navGamesHtml);
    output = output.replace('{%MAIN_CONTENT%}', '<h2 style="margin:auto; letter-spacing:4px; font-weight: 300; font-size: 30px;">STRONA NIE ISTNIEJE</h2>');
    res.status(404);
    res.send(output);
});

const port = process.env.port || 3000;
app.listen(port, () => {
  console.log(`App running on port ${port}...`)
})