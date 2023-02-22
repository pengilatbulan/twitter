const http = require('http');
const xml2json = require('xml2json');
const striptags = require('striptags');
const { Pool } = require('pg');
const express = require('express')
const bodyParser = require('body-parser')
const mountRoutes = require('./routes')
const app = express()
const port = 3000
const pool = new Pool({
  user: 'me',
  host: 'dpg-cfeb7gsgqg46rpn7ao20-a',
  database: 'cakcak',
  password: 'vq7TCgO99HCsu3JNcQmNtoQfLTlFoIwM',
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

const Twit = require('twit');

const T = new Twit({
  consumer_key:         'k1j3vY9lTpY8XktI63dImj6x1',
  consumer_secret:      'MPhRvdTN3BE8uj48dxsdNTpb1GV2ZR19MxDiSdSVrZe7lZzYgR',
  access_token:         '1110881633970745344-60jEawMTE3pjxKfiDhjtY9pdiYQcJZ',
  access_token_secret:  'ED2bcPMuaajZZem35QD4b8feKCRYRlFb4eznlam1SrREt'
});

// Set the location coordinates and radius in miles
const latitude = 4.079733;
const longitude = 102.116417;
const radius = 300; // 10 miles

app.use(bodyParser.json())
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
)

app.get('/health', (request, response) => {
    response.json({
        info: 'Tweets, but editable'
    })
})
mountRoutes(app);

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') 
  {
    try 
    {
      const client = await pool.connect();
      const result = await client.query('SELECT $1::text as message', ['Hello, world!']);
      const message = result.rows[0].message;
      client.release();      
      res.setHeader('Content-Type', 'application/json');   //text/plain
      res.end(JSON.stringify({ message: message }));
    } 
    catch (err) 
    {
      console.error('Error executing query', err.stack);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  } else if(req.method === 'GET' && req.url === '/health') 
  {
     try 
    {
      const client = await pool.connect();
      const result = await client.query('SELECT $1::text as message', ['The Server is healthy!']);
      const message = result.rows[0].message;
      client.release();      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: message }));
    } 
    catch (err) 
    {
      console.error('Error executing query', err.stack);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  } else if (req.method === 'GET' && req.url === '/harakah') {
  try {
    const client = await pool.connect();

    http.get('http://harakahdaily.net/index.php/feed/', (response) => {
  let xml = '';
  response.on('data', (chunk) => {
    xml += chunk;
  });
  response.on('end', () => {
    const options = {
      object: true,
      reversible: false,
      coerce: false,
      sanitize: true,
      trim: true,
      arrayNotation: false,
      alternateTextNode: false
    };
    const result = xml2json.toJson(xml, options);
    const items = result.rss.channel.item;
    const extractedItems = items.map((item) => {
      const title = striptags(item.title);
      const description = striptags(item.description);
      const pubDate = item.pubDate;
      const contentEncoded = striptags(item['content:encoded']);
      return { title, description, pubDate, contentEncoded };
    });
    console.log(JSON.stringify(extractedItems, null, 2));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: extractedItems }));
  });
}).on('error', (err) => {
  console.error(err);
});

    client.release();
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.statusCode = 500;
    res.end('Internal server error');
  }
} else if (req.method === 'GET' && req.url.startsWith('/ts')) {
  try {
    const client = await pool.connect();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const keyword = url.searchParams.get('keyword');
    const count = url.searchParams.get('count') || 10; // default value is 10
    if (!keyword) {
      res.statusCode = 400;
      res.end('Please provide the "keyword" parameter');
      return;
    }
    T.get('search/tweets', { q: keyword, geocode: `${latitude},${longitude},${radius}km`, count: count, tweet_mode: 'extended', include_rts: false, exclude_replies: true }, function(err, data, response) {
      console.log(data);
      // Check if data has a `statuses` property that contains an array of tweets
      if (!data.statuses) {
        res.statusCode = 400;
        res.end('No tweets found');
        return;
      }
      const filteredTweet = data.statuses.map(obj => {
        return {
          created_at: obj.created_at,
          id_str: obj.id_str,
          name: obj.user.name,
          screen_name: obj.user.screen_name,
          followers_count: obj.user.followers_count,
          favorite_count: obj.favorite_count,
          full_text: obj.full_text
        };
      });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(filteredTweet));
    });
    client.release();
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.statusCode = 500;
    res.end('Internal server error');
  }
}
  else 
  {
    res.statusCode = 404;
    res.end('Not found');
  }
  
});

server.listen(port, () => {
  console.log('Server is listening on port '+ port.toString());
});


// access token validator
async function validateAccessToken(id,token){
  const { rows } = await pool.query("SELECT access_token FROM users WHERE ID = $1",[id])
  const accessToken = rows[0]['access_token']
  if(accessToken == token) return true
  else return false
}

// tweet ownership verification
async function verifyTweetOwnership(user_id,tweet_id){
  const { rows } = await pool.query("SELECT tweet_by FROM tweets WHERE ID = $1",[tweet_id])
  const tweet_by = rows[0]['tweet_by']
  if(tweet_by == user_id) return true
  else return false
}

// is a tweet editable or not?
// a tweet is only editable in the first 60 seconds of it being posted.
// the client should also have their own handle to this.
async function tweetEditable(tweet_id){
  const { rows } = await pool.query("SELECT tweet_time FROM tweets WHERE ID = $1",[tweet_id])
  const tweet_time= rows[0]['tweet_time']
  // get the current time now
  const time_now = helper.getCurrentTimestamp
  
  // remove 60 seconds from time_now...
  // if that value is less than tweet_time. Allow the edit. If not.. then don't
  if((time_now - 60) < tweet_time){
    return true
  }else{ return false }
 
}

// verify if tweet exists (with ID)(might use UID's later)
async function verifyTweetExistance(tweet_id){
  const { rowCount } = await pool.query("SELECT ID FROM tweets WHERE ID = $1",[tweet_id])
  if(rowCount) return true
  else return false
}

module.exports = {
    query: (text, params, callback) => {
      return pool.query(text, params, callback)
    },
    validateAccessToken,
    verifyTweetOwnership,
    verifyTweetExistance,
    tweetEditable
}
