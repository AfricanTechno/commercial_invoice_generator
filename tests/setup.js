/**
 * Test setup — loads index.html into jsdom and executes catalogue.js + invoice.js
 * Provides a fresh DOM environment for each test file that requires it.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function createInvoiceDOM() {
  const htmlPath = path.resolve(__dirname, '..', 'index.html');
  const cataloguePath = path.resolve(__dirname, '..', 'js', 'catalogue.js');
  const invoicePath = path.resolve(__dirname, '..', 'js', 'invoice.js');

  const html = fs.readFileSync(htmlPath, 'utf-8');
  const catalogueJS = fs.readFileSync(cataloguePath, 'utf-8');
  const invoiceJS = fs.readFileSync(invoicePath, 'utf-8');

  const dom = new JSDOM(html, {
    url: 'http://localhost:8080',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    storageQuota: 10 * 1024 * 1024
  });

  const { window } = dom;

  // Execute scripts in order
  window.eval(catalogueJS);
  window.eval(invoiceJS);

  return { dom, window, document: window.document };
}

module.exports = { createInvoiceDOM };
