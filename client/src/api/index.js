/**
 * API 服务层 — 基于 WebSocket 通信
 *
 * 所有 API 调用通过 WebSocket 持久连接发送，支持请求-响应与实时推送。
 */

import wsClient from './ws';
import { getOrCreateVisitorId } from '../visitorIdentity';

// ─── 认证 API ─────────────────────────────────────

export const authAPI = {
  login: (userName, password) =>
    {
           //处理回调函数逻辑
           return wsClient.send('auth.login', { userName, password, visitorId: getOrCreateVisitorId() });
         },

  register: (userName, password, name, quoteReference = '') =>
    {
              //处理回调函数逻辑
              return wsClient.send('auth.register', { userName, password, name, quoteReference, visitorId: getOrCreateVisitorId() });
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
  chat: (message, visitorId) =>
    {
          //处理回调函数逻辑
          return wsClient.send('support.chat', { message, visitorId });
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

  transferConversation: (conversationId, toUserName) =>
    wsClient.send('support.conversation.transfer', { conversationId, toUserName }),

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

  sendMessage: (content, roomId, toUserName) =>
    {
                 //处理回调函数逻辑
                 return wsClient.send('im.send', { roomId, toUserName, content });
               },
};

// ─── 管理员内容与用户 API ─────────────────────────

export const adminAPI = {
  getUsers: () => {
              //处理回调函数逻辑
              return wsClient.send('admin.users');
            },
  updateUserRole: (userName, role) => {
                    return wsClient.send('admin.users.update-role', { userName, role });
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
