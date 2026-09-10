require('dotenv').config();
const https = require('https');

// MCP сервер для Kommo
class KommoMCP {
  constructor() {
    this.apiKey = process.env.KOMMO_API_KEY;
    this.subdomain = process.env.KOMMO_SUBDOMAIN;
    this.integrationId = process.env.KOMMO_INTEGRATION_ID;

    if (!this.apiKey || !this.subdomain) {
      throw new Error('KOMMO_API_KEY и KOMMO_SUBDOMAIN требуются в .env');
    }
  }

  // Метод для выполнения HTTP запросов к Kommo API
  async request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: `${this.subdomain}.kommo.com`,
        path: path,
        method: method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve(data);
            }
          } else {
            reject(new Error(`API Error ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // Получить все контакты с поддержкой пагинации
  async getContacts(limit = 50, page = 1) {
    return this.request('GET', `/api/v4/contacts?limit=${limit}&page=${page}`);
  }

  // Получить все контакты (все страницы)
  async getAllContacts() {
    let allContacts = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const result = await this.getContacts(250, page);
        const contacts = result._embedded?.contacts || [];
        if (contacts.length === 0) {
          hasMore = false;
        } else {
          allContacts = allContacts.concat(contacts);
          page++;
        }
      } catch (error) {
        console.error(`Ошибка при получении страницы ${page}:`, error.message);
        hasMore = false;
      }
    }

    return allContacts;
  }

  // Получить все deals
  async getDeals(limit = 50) {
    return this.request('GET', `/api/v4/leads?limit=${limit}`);
  }

  // Получить deal по ID
  async getDealById(id) {
    return this.request('GET', `/api/v4/leads/${id}`);
  }

  // Обновить deal
  async updateDeal(id, data) {
    return this.request('PATCH', `/api/v4/leads/${id}`, data);
  }

  // Создать task
  async createTask(data) {
    return this.request('POST', '/api/v4/tasks', data);
  }

  // Получить tasks
  async getTasks(limit = 50) {
    return this.request('GET', `/api/v4/tasks?limit=${limit}`);
  }

  // Получить статистику по месяцам
  async getMonthStats() {
    const contacts = await this.getAllContacts();

    const stats = {
      total: contacts.length,
      byMonth: {},
      august2026: 0,
      september2026: 0,
      other: 0
    };

    contacts.forEach(contact => {
      const createdAt = contact.created_at || contact.date_create;
      if (!createdAt) return;

      const date = new Date(createdAt * 1000); // Kommo возвращает timestamp
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthName = date.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

      // Подсчитываем по месяцам
      if (!stats.byMonth[monthName]) {
        stats.byMonth[monthName] = 0;
      }
      stats.byMonth[monthName]++;

      // Специальные переменные для августа и сентября
      if (year === 2026 && month === 8) {
        stats.august2026++;
      } else if (year === 2026 && month === 9) {
        stats.september2026++;
      } else {
        stats.other++;
      }
    });

    return stats;
  }
}

// HTTP сервер
const http = require('http');
const kommo = new KommoMCP();

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // Маршруты API
    if (req.url === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', message: 'Kommo MCP Server is running' }));
    }
    else if (req.url === '/stats') {
      const stats = await kommo.getMonthStats();
      res.writeHead(200);
      res.end(JSON.stringify(stats, null, 2));
    }
    else if (req.url === '/contacts') {
      const result = await kommo.getContacts();
      res.writeHead(200);
      res.end(JSON.stringify(result));
    }
    else if (req.url === '/deals') {
      const result = await kommo.getDeals();
      res.writeHead(200);
      res.end(JSON.stringify(result));
    }
    else if (req.url.startsWith('/deals/')) {
      const id = req.url.split('/')[2];
      const result = await kommo.getDealById(id);
      res.writeHead(200);
      res.end(JSON.stringify(result));
    }
    else if (req.url === '/tasks') {
      const result = await kommo.getTasks();
      res.writeHead(200);
      res.end(JSON.stringify(result));
    }
    else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
  } catch (error) {
    console.error('Error:', error.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: error.message }));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Kommo MCP Server запущен на порту ${PORT}`);
  console.log(`🔗 API доступен по адресу: http://localhost:${PORT}`);
  console.log(`📍 Kommo Subdomain: ${kommo.subdomain}`);
  console.log(`📊 Stats доступна по адресу: http://localhost:${PORT}/stats`);
});
