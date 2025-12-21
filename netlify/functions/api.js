import { connectDB } from './utils/db.js'
import { apiHandlers } from './utils/handlers.js'

export const handler = async (event) => {
  try {
    const method = event.httpMethod.toLowerCase()
    const params = event.queryStringParameters || {}
    const { type } = params

    if (!type) {
      return createResponse(400, { error: 'type parameter is required' })
    }

    if (!apiHandlers[method] || !apiHandlers[method][type]) {
      return createResponse(404, { error: `Handler not found for ${method} ${type}` })
    }

    await connectDB()

    let body = null
    if (method === 'post' && event.body) {
      body = JSON.parse(event.body)
    }

    const result = await apiHandlers[method][type](method === 'post' ? body : params)
    return createResponse(200, result)
  } catch (error) {
    console.error('API Error:', error)
    return createResponse(500, { error: error.message })
  }
}

const createResponse = (statusCode, data) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  },
  body: JSON.stringify(data),
})
