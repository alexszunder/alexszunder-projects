require('dotenv').config();
const http = require('http');
const axios = require('axios');

const KOMMO_API_KEY = process.env.KOMMO_API_KEY;
const SUBDOMAIN = process.env.SUBDOMAIN;
const INTEGRATION_ID = process.env.INTEGRATION_ID;
const PORT = process.env.PORT || 3000;

const api = axios.create({
  baseURL: `https://${SUBDOMAIN}.kommo.com/api/v4`,
  headers: { 'Authorization': `Bearer ${KOMMO_API_KEY}` }
});

class KommoMCP {
  async request(method, path, body = null) {
    try {
      const config = { method, url: path };
      if (body) config.data = body;
      const response = await api(config);
      return response.data;
    } catch (error) {
      console.error(`API Error: ${error.message}`);
      throw error;
    }
  }

  async getContacts(limit = 250) {
    return this.request('GET', `/contacts?limit=${limit}`);
  }

  async getDeals(limit = 250) {
    return this.request('GET', `/leads?limit=${limit}`);
  }

  async getDealById(id) {
    return this.request('GET', `/leads/${id}`);
  }

  async updateDeal(id, data) {
    return this.request('PATCH', `/leads/${id}`, data);
  }

  async createTask(data) {
    return this.request('POST', '/tasks', data);
  }

  async getTasks(limit = 250) {
    return this.request('GET', `/tasks?limit=${limit}`);
  }
}

const kommo = new KommoMCP();

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', service: 'kommo-mcp' }));
  } else if (req.url === '/contacts' && req.method === 'GET') {
    try {
      const contacts = await kommo.getContacts();
      res.writeHead(200);
      res.end(JSON.stringify(contacts));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  } else if (req.url === '/deals' && req.method === 'GET') {
    try {
      const deals = await kommo.getDeals();
      res.writeHead(200);
      res.end(JSON.stringify(deals));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  } else if (req.url.match(/^\/deals\/\d+$/) && req.method === 'GET') {
    try {
      const id = req.url.split('/')[2];
      const deal = await kommo.getDealById(id);
      res.writeHead(200);
      res.end(JSON.stringify(deal));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  } else if (req.url === '/tasks' && req.method === 'GET') {
    try {
      const tasks = await kommo.getTasks();
      res.writeHead(200);
      res.end(JSON.stringify(tasks));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`✅ MCP Server running at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
