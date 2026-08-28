/**
 * API 服务层 — 基于 WebSocket 通信
 *
 * 所有 API 调用通过 WebSocket 持久连接发送，支持请求-响应与实时推送。
 */

import wsClient from './ws';

// ─── 认证 API ─────────────────────────────────────

export const authAPI = {
  login: (username, password) =>
    {
           //处理回调函数逻辑
           return wsClient.send('auth.login', { username, password });
         },

  register: (username, password, name, quoteReference = '') =>
    {
              //处理回调函数逻辑
              return wsClient.send('auth.register', { username, password, name, quoteReference });
            },

  getMe: () =>
    {
           //处理回调函数逻辑
           return wsClient.send('auth.me');
         },
};

// ─── 商品 API ─────────────────────────────────────

export const productAPI = {
  getList: (params = {}) =>
    {
             //处理回调函数逻辑
             return wsClient.send('products.list', params);
           },

  getCategories: () =>
    {
                   //处理回调函数逻辑
                   return wsClient.send('products.categories');
                 },

  getById: (id) =>
    {
             //处理回调函数逻辑
             return wsClient.send('products.get', { id });
           },

  create: (product) =>
    {
            //处理回调函数逻辑
            return wsClient.send('products.create', product);
          },

  update: (id, product) =>
    {
            //处理回调函数逻辑
            return wsClient.send('products.update', { id, ...product });
          },

  delete: (id) =>
    {
            //处理回调函数逻辑
            return wsClient.send('products.delete', { id });
          },
};

// ─── RFQ 选品清单 API ────────────────────────────

export const rfqAssortmentAPI = {
  getList: () =>
    {
             //处理回调函数逻辑
             return wsClient.send('assortment.get');
           },

  add: (productId, quantity = 1) =>
    {
         //处理回调函数逻辑
         return wsClient.send('assortment.add', { productId, quantity });
       },

  updateQuantity: (productId, quantity) =>
    {
                    //处理回调函数逻辑
                    return wsClient.send('assortment.update', { productId, quantity });
                  },

  remove: (productId) =>
    {
            //处理回调函数逻辑
            return wsClient.send('assortment.remove', { productId });
          },

  clear: () =>
    {
           //处理回调函数逻辑
           return wsClient.send('assortment.clear');
         },
};

// ─── 询盘 API ────────────────────────────────────

export const quoteAPI = {
  submit: (request) =>
    {
            //处理回调函数逻辑
            return wsClient.send('quote.submit', request);
          },
};

// ─── 客服 API ─────────────────────────────────────

export const supportAPI = {
  chat: (message) =>
    {
          //处理回调函数逻辑
          return wsClient.send('support.chat', { message });
        },

  getFAQ: () =>
    {
            //处理回调函数逻辑
            return wsClient.send('support.faq');
         },

  getConversation: (conversationId) =>
    wsClient.send('support.conversation.get', conversationId ? { conversationId } : {}),

  sendMessage: (content, conversationId) =>
    wsClient.send('support.message.send', { content, conversationId }),

  requestHuman: () =>
    wsClient.send('support.handoff.request'),

  getQueue: () =>
    wsClient.send('support.queue.list'),

  claimConversation: (conversationId) =>
    wsClient.send('support.conversation.claim', { conversationId }),

  transferConversation: (conversationId, toUserId) =>
    wsClient.send('support.conversation.transfer', { conversationId, toUserId }),

  resolveConversation: (conversationId) =>
    wsClient.send('support.conversation.resolve', { conversationId }),

  getStaff: () =>
    wsClient.send('support.staff.list'),
};

// ─── IM API ───────────────────────────────────────

export const imAPI = {
  getSales: () =>
    {
              //处理回调函数逻辑
              return wsClient.send('im.sales');
            },

  getRooms: () =>
    {
              //处理回调函数逻辑
              return wsClient.send('im.rooms');
            },

  getMessages: (roomId) =>
    {
                 //处理回调函数逻辑
                 return wsClient.send('im.messages', { roomId });
               },

  sendMessage: (content, roomId, toUserId) =>
    {
                 //处理回调函数逻辑
                 return wsClient.send('im.send', { roomId, toUserId, content });
               },
};

// ─── 管理员内容与用户 API ─────────────────────────

export const adminAPI = {
  getUsers: () => {
              //处理回调函数逻辑
              return wsClient.send('admin.users');
            },
  updateUserRole: (userId, role) => {
                    return wsClient.send('admin.users.update-role', { userId, role });
                  },
  getArticles: () => {
                 //处理回调函数逻辑
                 return wsClient.send('admin.articles.list');
               },
  createArticle: (article) => {
                   //处理回调函数逻辑
                   return wsClient.send('admin.articles.create', article);
                 },
  deleteArticle: (id) => {
                   //处理回调函数逻辑
                   return wsClient.send('admin.articles.delete', { id });
                 },
  getFaqs: () => {
             //处理回调函数逻辑
             return wsClient.send('admin.faqs.list');
           },
  createFaq: (faq) => {
               //处理回调函数逻辑
               return wsClient.send('admin.faqs.create', faq);
             },
  deleteFaq: (id) => {
               //处理回调函数逻辑
               return wsClient.send('admin.faqs.delete', { id });
             },
};

export { wsClient };
export default { authAPI, productAPI, rfqAssortmentAPI, quoteAPI, supportAPI, imAPI, adminAPI };
