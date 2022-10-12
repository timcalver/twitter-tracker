const axios = require('axios');
const fs = require("fs");
const TelegramBot = require('node-telegram-bot-api');
require('better-logging')(console);

console.info('Launching database')
var data = require('./databases/data.json')
var rating = require('./databases/rating.json')
var settings = require('./databases/settings.json')

setInterval(function() {
    fs.writeFileSync("./databases/data.json", JSON.stringify(data, null, "\t"), function(error) {
      if(error) throw error;
    });
    fs.writeFileSync("./databases/rating.json", JSON.stringify(rating, null, "\t"), function(error) {
      if(error) throw error;
    });
    fs.writeFileSync("./databases/settings.json", JSON.stringify(settings, null, "\t"), function(error) {
      if(error) throw error;
    });
}, 1000);

//-----------------------------------------------//
// Settings

const telegram_admin = 379401460; // ID og Telegram user
const check_delay = 60 // Timeout between check

// Accounts to spectate you can write to databases/settings.json or use command /add [login] in bot

const places_in_rating = 5 // Top ranks
const places_emoji = ['1⃣','2⃣','3⃣','4⃣','5⃣'] // Emojis for Top 5

// Bearer tokens of Twitter you can write to databases/settings.json, or with command /add_token [token] in bot (can a many but using space)

const telegram_token = '997410976:AAHtfHLKE3mZ8VtNjR-l6iFcYPhWXPq1nX8'; // Token of Telegram bot, can get in @botfather

//-----------------------------------------------//

console.info('Starting bot')
const bot = new TelegramBot(telegram_token, {polling: true});

if(telegram_token === '') {
  console.error('Enter Telegram token')
  process.exit(-1);
}

if(telegram_admin === '' || settings.accounts.length === 0 || places_emoji.length === 0) {
  console.error('Please, config all settings')
  process.exit(-1);
}

console.info(`All works good`)
console.info(`Twitter tokens uploaded: ${settings.tokens.length}`)
bot.sendMessage(telegram_admin, `😼 | Script started!\n\n⌚ Timeout: ${check_delay} min.\n📋 Tokens: ${settings.tokens.length}\n\n🖥 Accounts: ${settings.accounts}`)

bot.on('message', async (message) => {
  const chatID = message.chat.id;
  const text = message.text;
  const cmd = text.split(' ')

  if(telegram_admin != chatID) return;

  if(cmd[0] === '/add') {
    if(!cmd[1]) return;
    if(settings.accounts.includes(cmd[1])) {
      bot.sendMessage(telegram_admin, `🖥 | Account ${cmd[1]} already have been added to list.`)
      return;
    }
    settings.accounts.push(cmd[1])
    bot.sendMessage(telegram_admin, `🖥 | Account added ${cmd[1]}`)
  }

  if(cmd[0] === '/add_token') {
    if(cmd.length === 1) return;
    cmd.shift()
    var data = {success: 0, error: 0}
    cmd.forEach(element => {
      if(settings.tokens.includes(element)) {
        data.error++
        bot.sendMessage(telegram_admin, `🖥 | ERROR | Token ${element} already in list.`)
        return;
      }
      settings.tokens.push(element)
      console.info(`Added new Twitter token, actually number: ${settings.tokens.length}`)
      data.success++
    })
    bot.sendMessage(telegram_admin, `🖥 | (${settings.tokens.length}) Adding of tokens had been ended.\n\nSuccess: ${data.success}\nError: ${data.error}`)
  }

  if(cmd[0] === '/list') {
    bot.sendMessage(telegram_admin, `🖥 | Actual list of accounts (${settings.accounts.length}) :\n${settings.accounts.toString().replace(/,/g, ', ')}`)
  }

  if(cmd[0] === '/tokens') {
    bot.sendMessage(telegram_admin, `🖥 | Actual list of tokens (${settings.tokens.length}) :\n${settings.tokens.toString().replace(/,/g, '\n')}`)
  }

});

var currentToken = 1
function getToken() {
  var res = settings.tokens[currentToken-1]
  if(currentToken === settings.tokens.length) {
    currentToken = 0
  }
  currentToken++
  return res;
}

const getFollowing = async (id) => {
  var a
  await axios.get(`https://api.twitter.com/2/users/${id}/following?max_results=1000`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  }).then(data => {
    a = data
  })
  return a;
}

const getByUsername = async (username) => {
  var a
  await axios.get(`https://api.twitter.com/2/users/by/username/${username}`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  }).then(data => {
    a = data
  })
  return a;
}

const getByID = async (id) => {
  var a
  await axios.get(`https://api.twitter.com/2/users/${id}`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  }).then(data => {
    a = data
  })
  return a;
}

async function CheckInBase(name) {
  if(!data[name]){
    var a
    a = await getByUsername(name).then(data => getFollowing(data.data.data.id))
    data[name] = {
      'followingIDS': [],
      'followingData': {}
    }
    a.data.data.forEach(element => {
      var id = element.id;
      data[name].followingIDS.push(id)
      data[name].followingData[id] = {
        'name': element.name,
        'username': element.username
      }
    });
  }
}

function CheckInRating(name) {
  if(!rating.daily || !rating.week || !rating.month) {
    rating.daily = {}
    rating.week = {}
    rating.month = {}
  }
  if(!rating.daily[name]){
    rating.daily[name] = 0
    rating.week[name] = 0
    rating.month[name] = 0
  }
}

function addToRating(name, count) {
  rating.daily[name] += count
  rating.week[name] += count
  rating.month[name] += count
}

async function CheckNewFollowings(name) {
  var now_following = await getByUsername(name).then(data => getFollowing(data.data.data.id))
  if(data[name].followingIDS.length !== now_following.data.data.length) {
    var now_following_array = []
    now_following.data.data.forEach(element => {
      now_following_array.push(element.id)
    });
    now_following.data.data.forEach(element => {
      var id = element.id;
      data[name].followingData[id] = {
        'name': element.name,
        'username': element.username
      }
    });
    const s = new Set(data[name].followingIDS);
    var new_items = now_following_array.filter(e => !s.has(e))
    var new_formated_items = ''
    new_items.forEach(element => {
      new_formated_items += `🟡 Name: ${data[name].followingData[element].name}\n🔗 Link: https://twitter.com/${data[name].followingData[element].username}\n\n`
    })
    if(new_items.length === 0) {
      //console.log('Unfollow detected')
      var a
      a = await getByUsername(name).then(data => getFollowing(data.data.data.id))
      data[name] = {
        'followingIDS': [],
        'followingData': {}
      }
      a.data.data.forEach(element => {
        var id = element.id;
        data[name].followingIDS.push(id)
        data[name].followingData[id] = {
          'name': element.name,
          'username': element.username
        }
      });
    } else {
      bot.sendMessage(telegram_admin, `🖥 | User ${name} subscripted for ${new_items.length} new users:\n\n${new_formated_items}`)
      new_items.forEach(element => {
        CheckInRating(element)
        addToRating(element, 1)
      })
    }
    new_items.forEach(element => {
      data[name].followingIDS.push(element)
    });
  }
}

async function getRating(rating_items, title) {
  var rating_sorted = []
  var items = rating_items
  for (var item in items) {
    rating_sorted.push([item, items[item]]);
  }
  if(rating_sorted.length === 0) {
    bot.sendMessage(telegram_admin, `For ${title} no one from spectating accounts didn't subscribe anyone.`)
    return;
  }

  rating_sorted.sort(function(a, b) {
    return b[1] - a[1];
  });

  rating_sorted.forEach(element => {
    getByID(element[0]).then(res => {
      element.push(res.data.data.name)
      element.push(res.data.data.username)
    })
  })
  setTimeout(() => {
    var text = `🏅 Rating of new users for ${title}:\n\n`
    var place = 1
    rating_sorted.forEach(element => {
      if(place === places_in_rating+1) return;
      text += `${places_emoji[place-1]} place: +${element[1]} subscriber(s)\n🟡 Name: ${element[2]}\n🔗 Link: https://twitter.com/${element[3]}\n\n`
      place++
    })
    bot.sendMessage(telegram_admin, text, {
      disable_web_page_preview: true
    })
  }, 1000);
}

settings.accounts.forEach(element => {
  CheckInBase(element)
})

setInterval(() => {
  settings.accounts.forEach(element => {
    CheckNewFollowings(element)
  })
  console.info('Subscriptions checked')
}, check_delay * 60 * 1000);

const day = 1000 * 60 * 60 * 24
var weeks = 0

setInterval(() => {
  getRating(rating.daily, 'day')
  console.info('Submitted daily rating')
  rating.daily = {}
}, day);

setInterval(() => {
  getRating(rating.week, 'week')
  console.info('Submitted weekly rating')
  rating.week = {}
  weeks++
  if(weeks === 4) {
    getRating(rating.month, 'month')
    console.info('Monthly rating sent')
    rating.month = {}
    weeks = 0
  }
}, day * 7);

