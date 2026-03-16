(function(global) {
  const DEFAULT_CONFIG = {
    supabaseUrl: '',
    supabaseAnonKey: '',
    supabaseScriptUrl: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
    enableSampleData: false,
    localContactsBootstrapUrl: '/local-data/address-book.local.json',
    localProductsBootstrapUrl: '/local-data/products.local.json'
  };

  const STORAGE_NAMES = {
    db: 'invoice_generator_cloud_v1',
    contacts: 'contacts_cache',
    products: 'products_cache',
    pending: 'pending_contact_ops',
    metadata: 'metadata',
    companyProfile: 'company_profile'
  };

  const META_KEYS = {
    migrationDismissed: 'legacy_migration_dismissed',
    migrationImported: 'legacy_migration_imported',
    lastSyncAt: 'last_sync_at',
    localContactsBootstrapImported: 'local_contacts_bootstrap_imported',
    localProductsBootstrapImported: 'local_products_bootstrap_imported'
  };

  const SAMPLE_CONTACTS = [
    {
      name: 'Sample Buyer GmbH',
      address1: 'Musterstrasse 10',
      city: 'Berlin',
      postalCode: '10115',
      country: 'DE',
      phone: '+49 30 123456',
      email: 'buyer@example.com',
      taxId: 'DE123456789',
      role_hints: ['consignee']
    },
    {
      name: 'Sample Import Services',
      address1: '100 Demo Logistics Way',
      city: 'Rotterdam',
      postalCode: '3011',
      country: 'NL',
      phone: '+31 10 123 4567',
      email: 'imports@example.com',
      taxId: 'NL999999999B01',
      role_hints: ['importer']
    }
  ];

  function getConfig() {
    return Object.assign({}, DEFAULT_CONFIG, global.APP_CONFIG || {});
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return 'id-' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function sortContacts(contacts) {
    return contacts.slice().sort((a, b) => {
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if (an && bn && an !== bn) return an.localeCompare(bn);
      return (a.updated_at || '').localeCompare(b.updated_at || '');
    });
  }

  function sortProducts(products) {
    return products.slice().sort((a, b) => {
      const ac = (a.category || '').toLowerCase();
      const bc = (b.category || '').toLowerCase();
      if (ac !== bc) return ac.localeCompare(bc);
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if (an !== bn) return an.localeCompare(bn);
      return (a.updated_at || '').localeCompare(b.updated_at || '');
    });
  }

  function normalizeRoleHints(roleHints) {
    const seen = new Set();
    return (Array.isArray(roleHints) ? roleHints : [])
      .map((hint) => String(hint || '').trim().toLowerCase())
      .filter(Boolean)
      .filter((hint) => {
        if (seen.has(hint)) return false;
        seen.add(hint);
        return true;
      });
  }

  function trimString(value) {
    return String(value || '').trim();
  }

  function splitLegacyAddress(address) {
    const lines = trimString(address)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return {
      address1: lines[0] || '',
      address2: lines.slice(1).join(', '),
      city: '',
      stateProvince: '',
      postalCode: '',
      country: ''
    };
  }

  function normalizeAddressFields(source) {
    const next = source || {};
    const hasStructured = [
      next.address1,
      next.address2,
      next.city,
      next.stateProvince,
      next.state_province,
      next.postalCode,
      next.postal_code,
      next.country
    ].some(Boolean);
    if (hasStructured) {
      return {
        address1: trimString(next.address1),
        address2: trimString(next.address2),
        city: trimString(next.city),
        stateProvince: trimString(next.stateProvince || next.state_province),
        postalCode: trimString(next.postalCode || next.postal_code),
        country: trimString(next.country).toUpperCase()
      };
    }
    return splitLegacyAddress(next.address);
  }

  function normalizeContact(contact, base) {
    const now = nowIso();
    const source = Object.assign({}, base || {}, contact || {});
    const addressFields = normalizeAddressFields(source);
    const meaningful = [
      source.name,
      addressFields.address1,
      addressFields.address2,
      addressFields.city,
      addressFields.stateProvince,
      addressFields.postalCode,
      addressFields.country,
      source.phone,
      source.email,
      source.taxId,
      source.tax_id
    ].some(Boolean);
    if (!meaningful) return null;

    return {
      id: source.id || uuid(),
      owner_user_id: source.owner_user_id || '',
      name: trimString(source.name),
      ...addressFields,
      phone: trimString(source.phone),
      email: trimString(source.email),
      taxId: trimString(source.taxId || source.tax_id),
      role_hints: normalizeRoleHints(source.role_hints || source.roleHints),
      created_at: source.created_at || now,
      updated_at: source.updated_at || now,
      deleted_at: source.deleted_at || null
    };
  }

  function normalizeCompanyProfile(profile, base) {
    const source = Object.assign({}, base || {}, profile || {});
    const addressFields = normalizeAddressFields(source);
    const meaningful = [
      source.name,
      addressFields.address1,
      addressFields.address2,
      addressFields.city,
      addressFields.stateProvince,
      addressFields.postalCode,
      addressFields.country,
      source.phone,
      source.email,
      source.taxId,
      source.tax_id
    ].some(Boolean);
    if (!meaningful) return null;

    return {
      id: source.id || uuid(),
      owner_user_id: source.owner_user_id || '',
      linkedContactId: trimString(source.linkedContactId || source.linked_contact_id),
      syncWithContact: !!source.syncWithContact || source.sync_with_contact === true,
      name: trimString(source.name),
      ...addressFields,
      phone: trimString(source.phone),
      email: trimString(source.email),
      taxId: trimString(source.taxId || source.tax_id),
      created_at: source.created_at || nowIso(),
      updated_at: source.updated_at || nowIso()
    };
  }

  function normalizeProduct(product, base) {
    const now = nowIso();
    const source = Object.assign({}, base || {}, product || {});
    const name = trimString(source.name);
    if (!name) return null;
    return {
      id: source.id || uuid(),
      owner_user_id: source.owner_user_id || '',
      name,
      category: trimString(source.category) || 'Other',
      hs: trimString(source.hs || source.hs_code),
      unit: Number(source.unit != null ? source.unit : source.unit_price) || 0,
      sku: trimString(source.sku),
      origin: trimString(source.origin).toUpperCase(),
      weight: Number(source.weight) || 0,
      created_at: source.created_at || now,
      updated_at: source.updated_at || now,
      deleted_at: source.deleted_at || null
    };
  }

  function stripContact(contact) {
    return {
      name: contact.name || '',
      address1: contact.address1 || '',
      address2: contact.address2 || '',
      city: contact.city || '',
      stateProvince: contact.stateProvince || '',
      postalCode: contact.postalCode || '',
      country: contact.country || '',
      phone: contact.phone || '',
      email: contact.email || '',
      taxId: contact.taxId || ''
    };
  }

  function toRemoteContact(contact) {
    return {
      id: contact.id,
      owner_user_id: contact.owner_user_id,
      name: contact.name,
      address1: contact.address1,
      address2: contact.address2,
      city: contact.city,
      state_province: contact.stateProvince,
      postal_code: contact.postalCode,
      country: contact.country,
      phone: contact.phone,
      email: contact.email,
      tax_id: contact.taxId,
      role_hints: contact.role_hints,
      created_at: contact.created_at,
      updated_at: contact.updated_at,
      deleted_at: contact.deleted_at
    };
  }

  function toRemoteCompanyProfile(profile) {
    return {
      id: profile.id,
      owner_user_id: profile.owner_user_id,
      linked_contact_id: profile.linkedContactId || null,
      sync_with_contact: !!profile.syncWithContact,
      name: profile.name,
      address1: profile.address1,
      address2: profile.address2,
      city: profile.city,
      state_province: profile.stateProvince,
      postal_code: profile.postalCode,
      country: profile.country,
      phone: profile.phone,
      email: profile.email,
      tax_id: profile.taxId,
      created_at: profile.created_at,
      updated_at: profile.updated_at
    };
  }

  function toRemoteProduct(product) {
    return {
      id: product.id,
      owner_user_id: product.owner_user_id,
      name: product.name,
      category: product.category,
      hs_code: product.hs,
      unit_price: product.unit,
      sku: product.sku,
      origin: product.origin,
      weight: product.weight,
      created_at: product.created_at,
      updated_at: product.updated_at,
      deleted_at: product.deleted_at
    };
  }

  function isOnline() {
    return global.navigator ? global.navigator.onLine !== false : true;
  }

  async function fetchJsonIfAvailable(url) {
    if (!url || typeof global.fetch !== 'function') return null;
    try {
      const response = await global.fetch(url, { cache: 'no-store' });
      if (!response || !response.ok) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  function createMemoryDriver() {
    const contacts = new Map();
    const products = new Map();
    const pending = new Map();
    const metadata = new Map();
    let companyProfile = null;

    return {
      kind: 'memory',
      async getAllContacts() {
        return Array.from(contacts.values()).map(clone);
      },
      async putContact(contact) {
        contacts.set(contact.id, clone(contact));
      },
      async replaceContacts(nextContacts) {
        contacts.clear();
        nextContacts.forEach((contact) => contacts.set(contact.id, clone(contact)));
      },
      async getAllProducts() {
        return Array.from(products.values()).map(clone);
      },
      async putProduct(product) {
        products.set(product.id, clone(product));
      },
      async replaceProducts(nextProducts) {
        products.clear();
        nextProducts.forEach((product) => products.set(product.id, clone(product)));
      },
      async getPendingOps() {
        return Array.from(pending.values()).map(clone);
      },
      async putPendingOp(op) {
        pending.set(op.id, clone(op));
      },
      async deletePendingOp(id) {
        pending.delete(id);
      },
      async clearPendingOps() {
        pending.clear();
      },
      async getMeta(key) {
        return metadata.has(key) ? clone(metadata.get(key)) : null;
      },
      async setMeta(key, value) {
        metadata.set(key, clone(value));
      },
      async removeMeta(key) {
        metadata.delete(key);
      },
      async getCompanyProfile() {
        return companyProfile ? clone(companyProfile) : null;
      },
      async setCompanyProfile(profile) {
        companyProfile = clone(profile);
      },
      async clearCompanyProfile() {
        companyProfile = null;
      }
    };
  }

  function createIndexedDbDriver() {
    if (!global.indexedDB || typeof global.indexedDB.open !== 'function') {
      return createMemoryDriver();
    }

    let dbPromise = null;

    function requestToPromise(req) {
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    function openDb() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise((resolve, reject) => {
        const req = global.indexedDB.open(STORAGE_NAMES.db, 2);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORAGE_NAMES.contacts)) {
            db.createObjectStore(STORAGE_NAMES.contacts, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORAGE_NAMES.products)) {
            db.createObjectStore(STORAGE_NAMES.products, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORAGE_NAMES.pending)) {
            db.createObjectStore(STORAGE_NAMES.pending, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORAGE_NAMES.metadata)) {
            db.createObjectStore(STORAGE_NAMES.metadata, { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains(STORAGE_NAMES.companyProfile)) {
            db.createObjectStore(STORAGE_NAMES.companyProfile, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }).catch(() => createMemoryDriver());
      return dbPromise;
    }

    async function withStore(storeName, mode, callback) {
      const db = await openDb();
      if (db.kind === 'memory') {
        return callback(db);
      }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        Promise.resolve(callback(store))
          .then((value) => {
            tx.oncomplete = () => resolve(value);
            tx.onerror = () => reject(tx.error);
          })
          .catch(reject);
      });
    }

    return {
      kind: 'indexeddb',
      async getAllContacts() {
        return withStore(STORAGE_NAMES.contacts, 'readonly', async (store) => {
          if (store.kind === 'memory') return store.getAllContacts();
          return requestToPromise(store.getAll());
        });
      },
      async putContact(contact) {
        return withStore(STORAGE_NAMES.contacts, 'readwrite', async (store) => {
          if (store.kind === 'memory') return store.putContact(contact);
          store.put(clone(contact));
        });
      },
      async replaceContacts(nextContacts) {
        return withStore(STORAGE_NAMES.contacts, 'readwrite', async (store) => {
          if (store.kind === 'memory') return store.replaceContacts(nextContacts);
          store.clear();
          nextContacts.forEach((contact) => store.put(clone(contact)));
        });
      },
      async getAllProducts() {
        return withStore(STORAGE_NAMES.products, 'readonly', async (store) => {
          if (store.kind === 'memory') return store.getAllProducts();
          return requestToPromise(store.getAll());
        });
      },
      async putProduct(product) {
        return withStore(STORAGE_NAMES.products, 'readwrite', async (store) => {
          if (store.kind === 'memory') return store.putProduct(product);
          store.put(clone(product));
        });
      },
      async replaceProducts(nextProducts) {
        return withStore(STORAGE_NAMES.products, 'readwrite', async (store) => {
          if (store.kind === 'memory') return store.replaceProducts(nextProducts);
          store.clear();
          nextProducts.forEach((product) => store.put(clone(product)));
        });
      },
      async getPendingOps() {
        return withStore(STORAGE_NAMES.pending, 'readonly', async (store) => {
          if (store.kind === 'memory') return store.getPendingOps();
          return requestToPromise(store.getAll());
        });
      },
      async putPendingOp(op) {
        return withStore(STORAGE_NAMES.pending, 'readwrite', async (store) => {
          if (store.kind === 'memory') return store.putPendingOp(op);
          store.put(clone(op));
        });
      },
      async deletePendingOp(id) {
        return withStore(STORAGE_NAMES.pending, 'readwrite', async (store) => {
          if (store.kind === 'memory') return store.deletePendingOp(id);
          store.delete(id);
        });
      },
      async clearPendingOps() {
        return withStore(STORAGE_NAMES.pending, 'readwrite', async (store) => {
          if (store.kind === 'memory') return store.clearPendingOps();
          store.clear();
        });
      },
      async getMeta(key) {
        return withStore(STORAGE_NAMES.metadata, 'readonly', async (store) => {
          if (store.kind === 'memory') return store.getMeta(key);
          const row = await requestToPromise(store.get(key));
          return row ? row.value : null;
        });
      },
      async setMeta(key, value) {
        return withStore(STORAGE_NAMES.metadata, 'readwrite', async (store) => {
          if (store.kind === 'memory') return store.setMeta(key, value);
          store.put({ key, value: clone(value) });
        });
      },
      async removeMeta(key) {
        return withStore(STORAGE_NAMES.metadata, 'readwrite', async (store) => {
          if (store.kind === 'memory') return store.removeMeta(key);
          store.delete(key);
        });
      },
      async getCompanyProfile() {
        return withStore(STORAGE_NAMES.companyProfile, 'readonly', async (store) => {
          if (store.kind === 'memory') return store.getCompanyProfile();
          const row = await requestToPromise(store.get('default'));
          return row ? row.value : null;
        });
      },
      async setCompanyProfile(profile) {
        return withStore(STORAGE_NAMES.companyProfile, 'readwrite', async (store) => {
          if (store.kind === 'memory') return store.setCompanyProfile(profile);
          store.put({ key: 'default', value: clone(profile) });
        });
      },
      async clearCompanyProfile() {
        return withStore(STORAGE_NAMES.companyProfile, 'readwrite', async (store) => {
          if (store.kind === 'memory') return store.clearCompanyProfile();
          store.delete('default');
        });
      }
    };
  }

  function createSupabaseClientLoader(config) {
    let clientPromise = null;
    let scriptPromise = null;

    function isConfigured() {
      return !!(config.supabaseUrl && config.supabaseAnonKey);
    }

    function ensureScript() {
      if (!isConfigured()) return Promise.resolve(null);
      if (global.supabase && typeof global.supabase.createClient === 'function') {
        return Promise.resolve(global.supabase);
      }
      if (scriptPromise) return scriptPromise;

      scriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = config.supabaseScriptUrl;
        script.async = true;
        script.dataset.supabaseSdk = 'true';
        script.onload = () => resolve(global.supabase || null);
        script.onerror = () => reject(new Error('Could not load Supabase SDK'));
        document.head.appendChild(script);
      });
      return scriptPromise;
    }

    async function getClient() {
      if (!isConfigured()) return null;
      if (clientPromise) return clientPromise;
      clientPromise = ensureScript().then((sdk) => {
        if (!sdk || typeof sdk.createClient !== 'function') {
          throw new Error('Supabase SDK unavailable');
        }
        return sdk.createClient(config.supabaseUrl, config.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
      });
      return clientPromise;
    }

    return {
      isConfigured,
      getClient
    };
  }

  function createAuthManager(config) {
    const loader = createSupabaseClientLoader(config);
    let session = null;
    let subscription = null;
    const listeners = new Set();
    let lastError = '';
    let testSnapshot = null;

    function getSnapshot() {
      if (testSnapshot) return clone(testSnapshot);
      const user = session && session.user ? session.user : null;
      return {
        configured: loader.isConfigured(),
        signedIn: !!user,
        user: user ? clone(user) : null,
        email: user && user.email ? user.email : '',
        error: lastError
      };
    }

    function emit() {
      const snapshot = getSnapshot();
      listeners.forEach((listener) => listener(snapshot));
    }

    async function init() {
      if (testSnapshot) {
        emit();
        return getSnapshot();
      }
      if (!loader.isConfigured()) {
        emit();
        return getSnapshot();
      }
      const client = await loader.getClient();
      const result = await client.auth.getSession();
      session = result && result.data ? result.data.session : null;
      if (!subscription) {
        const sub = client.auth.onAuthStateChange(function(_event, nextSession) {
          session = nextSession || null;
          emit();
        });
        subscription = sub && sub.data ? sub.data.subscription : null;
      }
      lastError = '';
      emit();
      return getSnapshot();
    }

    async function signIn(email, password) {
      if (testSnapshot) {
        testSnapshot = {
          configured: true,
          signedIn: true,
          user: { id: 'test-user', email: email || 'test@example.com' },
          email: email || 'test@example.com',
          error: ''
        };
        emit();
        return getSnapshot();
      }
      const client = await loader.getClient();
      const result = await client.auth.signInWithPassword({ email, password });
      if (result.error) {
        lastError = result.error.message || 'Sign in failed';
        emit();
        throw result.error;
      }
      session = result.data ? result.data.session : session;
      lastError = '';
      emit();
      return getSnapshot();
    }

    async function signUp(email, password) {
      if (testSnapshot) {
        testSnapshot = {
          configured: true,
          signedIn: true,
          user: { id: 'test-user', email: email || 'test@example.com' },
          email: email || 'test@example.com',
          error: ''
        };
        emit();
        return getSnapshot();
      }
      const client = await loader.getClient();
      const result = await client.auth.signUp({ email, password });
      if (result.error) {
        lastError = result.error.message || 'Sign up failed';
        emit();
        throw result.error;
      }
      session = result.data ? result.data.session : session;
      lastError = '';
      emit();
      return getSnapshot();
    }

    async function signOut() {
      if (testSnapshot) {
        testSnapshot = Object.assign({}, testSnapshot, {
          signedIn: false,
          user: null,
          email: ''
        });
        emit();
        return getSnapshot();
      }
      const client = await loader.getClient();
      const result = await client.auth.signOut();
      if (result && result.error) throw result.error;
      session = null;
      lastError = '';
      emit();
      return getSnapshot();
    }

    async function getClient() {
      return loader.getClient();
    }

    return {
      init,
      signIn,
      signUp,
      signOut,
      getClient,
      setTestSnapshot(nextSnapshot) {
        testSnapshot = Object.assign({
          configured: false,
          signedIn: false,
          user: null,
          email: '',
          error: ''
        }, nextSnapshot || {});
        emit();
      },
      onChange(listener) {
        listeners.add(listener);
        listener(getSnapshot());
        return function unsubscribe() {
          listeners.delete(listener);
        };
      },
      getSnapshot
    };
  }

  function createSupabaseRemote(auth) {
    async function getAuthedClient() {
      const snapshot = auth.getSnapshot();
      if (!snapshot.configured || !snapshot.signedIn || !snapshot.user) return null;
      return auth.getClient();
    }

    return {
      async fetchContacts() {
        const client = await getAuthedClient();
        if (!client) return [];
        const result = await client
          .from('contacts')
          .select('*')
          .order('updated_at', { ascending: false });
        if (result.error) throw result.error;
        return result.data || [];
      },
      async fetchProducts() {
        const client = await getAuthedClient();
        if (!client) return [];
        const result = await client
          .from('products')
          .select('*')
          .order('updated_at', { ascending: false });
        if (result.error) throw result.error;
        return result.data || [];
      },
      async upsertContact(contact) {
        const client = await getAuthedClient();
        if (!client) throw new Error('Not signed in');
        const result = await client
          .from('contacts')
          .upsert(toRemoteContact(contact))
          .select()
          .single();
        if (result.error) throw result.error;
        return result.data;
      },
      async upsertProduct(product) {
        const client = await getAuthedClient();
        if (!client) throw new Error('Not signed in');
        const result = await client
          .from('products')
          .upsert(toRemoteProduct(product))
          .select()
          .single();
        if (result.error) throw result.error;
        return result.data;
      },
      async softDeleteContact(contact) {
        const client = await getAuthedClient();
        if (!client) throw new Error('Not signed in');
        const result = await client
          .from('contacts')
          .update({
            deleted_at: contact.deleted_at,
            updated_at: contact.updated_at,
            role_hints: contact.role_hints
          })
          .eq('id', contact.id)
          .select()
          .single();
        if (result.error) throw result.error;
        return result.data;
      },
      async softDeleteProduct(product) {
        const client = await getAuthedClient();
        if (!client) throw new Error('Not signed in');
        const result = await client
          .from('products')
          .update({
            deleted_at: product.deleted_at,
            updated_at: product.updated_at
          })
          .eq('id', product.id)
          .select()
          .single();
        if (result.error) throw result.error;
        return result.data;
      },
      async fetchCompanyProfile() {
        const client = await getAuthedClient();
        if (!client) return null;
        const result = await client
          .from('company_profiles')
          .select('*')
          .limit(1)
          .maybeSingle();
        if (result.error) throw result.error;
        return result.data || null;
      },
      async upsertCompanyProfile(profile) {
        const client = await getAuthedClient();
        if (!client) throw new Error('Not signed in');
        const result = await client
          .from('company_profiles')
          .upsert(toRemoteCompanyProfile(profile))
          .select()
          .single();
        if (result.error) throw result.error;
        return result.data;
      },
      async clearCompanyProfile(ownerUserId) {
        const client = await getAuthedClient();
        if (!client) throw new Error('Not signed in');
        const result = await client
          .from('company_profiles')
          .delete()
          .eq('owner_user_id', ownerUserId);
        if (result.error) throw result.error;
      }
    };
  }

  function createAddressBookRepository(options) {
    const config = getConfig();
    const driver = options && options.driver ? options.driver : createIndexedDbDriver();
    const auth = options && options.auth ? options.auth : createAuthManager(config);
    const remote = options && options.remote ? options.remote : createSupabaseRemote(auth);
    const legacyLocalStorageKey = (options && options.legacyLocalStorageKey) || 'invoice_addressbook';
    const legacyProductStorageKey = (options && options.legacyProductStorageKey) || 'invoice_product_library_v1';
    const seedProducts = Array.isArray(options && options.seedProducts) ? options.seedProducts : [];
    const listeners = new Set();

    const state = {
      ready: false,
      syncing: false,
      syncError: '',
      contacts: [],
      products: [],
      companyProfile: null,
      auth: auth.getSnapshot(),
      migrationAvailable: false
    };

    function canManageLocally() {
      return !state.auth.configured;
    }

    function canManageAddressBook() {
      return canManageLocally() || !!state.auth.signedIn;
    }

    function emit() {
      const snapshot = getState();
      listeners.forEach((listener) => listener(snapshot));
    }

    function getState() {
      return {
        ready: state.ready,
        syncing: state.syncing,
        syncError: state.syncError,
        contacts: clone(state.contacts),
        products: clone(state.products),
        companyProfile: state.companyProfile ? clone(state.companyProfile) : null,
        auth: clone(state.auth),
        migrationAvailable: state.migrationAvailable,
        online: isOnline(),
        enableSampleData: !!config.enableSampleData
      };
    }

    async function refreshLocalState() {
      const cachedContacts = await driver.getAllContacts();
      let cachedProducts = await driver.getAllProducts();
      if (!cachedProducts.length && seedProducts.length) {
        const normalizedSeeds = seedProducts.map((product) => normalizeProduct(product, product)).filter(Boolean);
        if (normalizedSeeds.length) {
          await driver.replaceProducts(normalizedSeeds);
          cachedProducts = await driver.getAllProducts();
        }
      }
      state.contacts = sortContacts(cachedContacts);
      state.products = sortProducts(cachedProducts);
      state.companyProfile = await driver.getCompanyProfile();
      state.migrationAvailable = !!(canManageAddressBook() && hasLegacyLocalContacts() && !hasMigrationBeenHandled());
      emit();
      return getState();
    }

    function hasLegacyLocalContacts() {
      try {
        const raw = global.localStorage.getItem(legacyLocalStorageKey);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.some((entry) => entry && (
          entry.name || entry.address || entry.address1 || entry.address2 || entry.city || entry.stateProvince || entry.postalCode || entry.country
        ));
      } catch (e) {
        return false;
      }
    }

    function hasMigrationBeenHandled() {
      try {
        return global.localStorage.getItem(META_KEYS.migrationImported) === 'true' ||
          global.localStorage.getItem(META_KEYS.migrationDismissed) === 'true';
      } catch (e) {
        return false;
      }
    }

    function markMigrationImported() {
      try {
        global.localStorage.setItem(META_KEYS.migrationImported, 'true');
        global.localStorage.removeItem(META_KEYS.migrationDismissed);
      } catch (e) {}
    }

    function dismissMigration() {
      try {
        global.localStorage.setItem(META_KEYS.migrationDismissed, 'true');
      } catch (e) {}
      state.migrationAvailable = false;
      emit();
    }

    async function queueOp(type, payload) {
      await driver.putPendingOp({
        id: uuid(),
        type,
        payload: clone(payload),
        created_at: nowIso()
      });
    }

    async function processPendingOps() {
      const ops = await driver.getPendingOps();
      const ordered = ops.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      for (const op of ordered) {
        if (op.type === 'upsert-contact') {
          await remote.upsertContact(op.payload);
        } else if (op.type === 'upsert-product') {
          await remote.upsertProduct(op.payload);
        } else if (op.type === 'delete-contact') {
          await remote.softDeleteContact(op.payload);
        } else if (op.type === 'delete-product') {
          await remote.softDeleteProduct(op.payload);
        } else if (op.type === 'upsert-company-profile') {
          await remote.upsertCompanyProfile(op.payload);
        } else if (op.type === 'clear-company-profile') {
          await remote.clearCompanyProfile(op.payload.owner_user_id);
        }
        await driver.deletePendingOp(op.id);
      }
    }

    async function sync() {
      if (!state.auth.configured || !state.auth.signedIn || !isOnline()) {
        return refreshLocalState();
      }

      state.syncing = true;
      state.syncError = '';
      emit();

      try {
        await processPendingOps();
        const cachedProducts = await driver.getAllProducts();
        const remoteContacts = await remote.fetchContacts();
        let remoteProducts = await remote.fetchProducts();
        if (!remoteProducts.length && cachedProducts.length) {
          for (const product of cachedProducts.filter((entry) => !entry.deleted_at)) {
            await remote.upsertProduct(product);
          }
          remoteProducts = await remote.fetchProducts();
        }
        const remoteProfile = await remote.fetchCompanyProfile();
        await driver.replaceContacts(remoteContacts.map((contact) => normalizeContact(contact, contact)).filter(Boolean));
        await driver.replaceProducts(remoteProducts.map((product) => normalizeProduct(product, product)).filter(Boolean));
        if (remoteProfile) {
          await driver.setCompanyProfile(normalizeCompanyProfile(remoteProfile, remoteProfile));
        } else {
          await driver.clearCompanyProfile();
        }
        await driver.setMeta(META_KEYS.lastSyncAt, nowIso());
      } catch (error) {
        state.syncError = error && error.message ? error.message : 'Sync failed';
      } finally {
        state.syncing = false;
      }

      return refreshLocalState();
    }

    async function autoImportLegacyLocalContactsIfNeeded() {
      if (state.auth.configured) return;
      const cachedContacts = await driver.getAllContacts();
      if (cachedContacts.length) return;
      if (!hasLegacyLocalContacts() || hasMigrationBeenHandled()) return;
      await importLegacyLocalContacts({ clearLegacy: true });
    }

    async function autoImportLegacyProductsIfNeeded() {
      let cachedProducts = await driver.getAllProducts();
      if (cachedProducts.length) return;
      try {
        const raw = global.localStorage.getItem(legacyProductStorageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed) || !parsed.length) return;
        const imported = parsed.map((product) => normalizeProduct(product, product)).filter(Boolean);
        if (!imported.length) return;
        await driver.replaceProducts(imported);
      } catch (e) {}
    }

    async function autoImportLocalBootstrapDataIfNeeded() {
      if (state.auth.configured) return;

      const existingContacts = await driver.getAllContacts();
      const contactEntries = await fetchJsonIfAvailable(config.localContactsBootstrapUrl);
      if (Array.isArray(contactEntries) && contactEntries.length) {
        const existingByName = new Set(
          existingContacts
            .filter((entry) => !entry.deleted_at)
            .map((entry) => String(entry.name || '').trim().toLowerCase())
            .filter(Boolean)
        );
        for (const entry of contactEntries) {
          const normalized = normalizeContact(entry, entry);
          if (!normalized) continue;
          const nameKey = String(normalized.name || '').trim().toLowerCase();
          if (nameKey && existingByName.has(nameKey)) continue;
          await driver.putContact(normalized);
          if (nameKey) existingByName.add(nameKey);
        }
        await driver.setMeta(META_KEYS.localContactsBootstrapImported, nowIso());
      }

      const existingProducts = await driver.getAllProducts();
      const bootstrapProducts = await fetchJsonIfAvailable(config.localProductsBootstrapUrl);
      const allBootstrapProducts = seedProducts.concat(Array.isArray(bootstrapProducts) ? bootstrapProducts : []);
      if (allBootstrapProducts.length) {
        const existingByName = new Set(
          existingProducts
            .filter((entry) => !entry.deleted_at)
            .map((entry) => String(entry.name || '').trim().toLowerCase())
            .filter(Boolean)
        );
        for (const entry of allBootstrapProducts) {
          const normalized = normalizeProduct(entry, entry);
          if (!normalized) continue;
          const nameKey = String(normalized.name || '').trim().toLowerCase();
          if (nameKey && existingByName.has(nameKey)) continue;
          await driver.putProduct(normalized);
          if (nameKey) existingByName.add(nameKey);
        }
        await driver.setMeta(META_KEYS.localProductsBootstrapImported, nowIso());
      }
    }

    async function init() {
      auth.onChange(async function(nextAuth) {
        state.auth = nextAuth;
        if (state.auth.signedIn && isOnline()) {
          await sync();
        } else {
          await refreshLocalState();
        }
      });

      if (global.addEventListener) {
        global.addEventListener('online', function() {
          sync();
        });
        global.addEventListener('offline', function() {
          emit();
        });
      }

      await auth.init();
      await autoImportLegacyLocalContactsIfNeeded();
      await autoImportLegacyProductsIfNeeded();
      await autoImportLocalBootstrapDataIfNeeded();
      state.ready = true;
      return refreshLocalState();
    }

    async function listContacts() {
      if (!state.ready) await init();
      return state.contacts.filter((contact) => !contact.deleted_at).map(clone);
    }

    async function listProducts() {
      if (!state.ready) await init();
      return state.products.filter((product) => !product.deleted_at).map(clone);
    }

    async function upsertContact(contact) {
      if (!canManageAddressBook()) throw new Error('Sign in is required to manage contacts');
      const existing = contact.id ? state.contacts.find((entry) => entry.id === contact.id) : state.contacts.find((entry) => entry.name === contact.name && !entry.deleted_at);
      const normalized = normalizeContact(contact, existing);
      if (!normalized) return null;

      normalized.owner_user_id = state.auth.user ? state.auth.user.id : normalized.owner_user_id;
      await driver.putContact(normalized);
      if (state.auth.configured) await queueOp('upsert-contact', normalized);
      await refreshLocalState();
      if (state.auth.configured && isOnline()) await sync();
      return clone(normalized);
    }

    async function upsertProduct(product) {
      if (!canManageAddressBook()) throw new Error('Sign in is required to manage products');
      const existing = product.id
        ? state.products.find((entry) => entry.id === product.id)
        : state.products.find((entry) => entry.name === product.name && !entry.deleted_at);
      const normalized = normalizeProduct(product, existing);
      if (!normalized) return null;

      normalized.owner_user_id = state.auth.user ? state.auth.user.id : normalized.owner_user_id;
      await driver.putProduct(normalized);
      if (state.auth.configured) await queueOp('upsert-product', normalized);
      await refreshLocalState();
      if (state.auth.configured && isOnline()) await sync();
      return clone(normalized);
    }

    async function deleteContact(contactId) {
      if (!canManageAddressBook()) throw new Error('Sign in is required to manage contacts');
      const existing = state.contacts.find((entry) => entry.id === contactId);
      if (!existing) return;
      const next = Object.assign({}, existing, {
        deleted_at: nowIso(),
        updated_at: nowIso()
      });
      await driver.putContact(next);
      if (state.auth.configured) await queueOp('delete-contact', next);
      await refreshLocalState();
      if (state.auth.configured && isOnline()) await sync();
    }

    async function deleteProduct(productId) {
      if (!canManageAddressBook()) throw new Error('Sign in is required to manage products');
      const existing = state.products.find((entry) => entry.id === productId);
      if (!existing) return;
      const next = Object.assign({}, existing, {
        deleted_at: nowIso(),
        updated_at: nowIso()
      });
      await driver.putProduct(next);
      if (state.auth.configured) await queueOp('delete-product', next);
      await refreshLocalState();
      if (state.auth.configured && isOnline()) await sync();
    }

    async function importContacts(entries) {
      if (!canManageAddressBook()) throw new Error('Sign in is required to import contacts');
      const imported = [];
      for (const entry of entries || []) {
        const next = await upsertContact(entry);
        if (next) imported.push(next);
      }
      return imported;
    }

    async function exportContacts() {
      const contacts = await listContacts();
      return contacts.map(stripContact);
    }

    async function saveCompanyProfile(profile) {
      if (!canManageAddressBook()) throw new Error('Sign in is required to save your company profile');
      const existing = state.companyProfile;
      const normalized = normalizeCompanyProfile(profile, existing);

      if (!normalized) {
        await clearCompanyProfile();
        return null;
      }

      normalized.owner_user_id = state.auth.user ? state.auth.user.id : normalized.owner_user_id;
      await driver.setCompanyProfile(normalized);
      if (state.auth.configured) await queueOp('upsert-company-profile', normalized);
      await refreshLocalState();
      if (state.auth.configured && isOnline()) await sync();
      return clone(normalized);
    }

    async function clearCompanyProfile() {
      if (!canManageAddressBook()) throw new Error('Sign in is required to clear your company profile');
      if (state.auth.configured && state.companyProfile && state.companyProfile.owner_user_id) {
        await queueOp('clear-company-profile', { owner_user_id: state.companyProfile.owner_user_id });
      }
      await driver.clearCompanyProfile();
      await refreshLocalState();
      if (state.auth.configured && isOnline()) await sync();
    }

    async function getCompanyProfile() {
      if (!state.ready) await init();
      return state.companyProfile ? clone(state.companyProfile) : null;
    }

    async function importLegacyLocalContacts(options) {
      if (!canManageAddressBook()) throw new Error('Sign in is required to import local contacts');
      let imported = [];
      try {
        const raw = global.localStorage.getItem(legacyLocalStorageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        imported = await importContacts(parsed);
        markMigrationImported();
        if (options && options.clearLegacy) {
          global.localStorage.removeItem(legacyLocalStorageKey);
        }
      } catch (error) {
        throw error;
      }
      state.migrationAvailable = false;
      emit();
      return imported;
    }

    async function loadSampleContacts() {
      if (!config.enableSampleData) throw new Error('Sample data is disabled');
      return importContacts(SAMPLE_CONTACTS);
    }

    return {
      init,
      sync,
      listContacts,
      listProducts,
      upsertContact,
      upsertProduct,
      deleteContact,
      deleteProduct,
      importContacts,
      exportContacts,
      getCompanyProfile,
      saveCompanyProfile,
      clearCompanyProfile,
      importLegacyLocalContacts,
      dismissMigration,
      loadSampleContacts,
      __debugSetAuthState(nextSnapshot) {
        auth.setTestSnapshot(nextSnapshot);
      },
      hasLegacyLocalContacts,
      onChange(listener) {
        listeners.add(listener);
        listener(getState());
        return function unsubscribe() {
          listeners.delete(listener);
        };
      },
      getState,
      auth: {
        init: auth.init,
        signIn: auth.signIn,
        signUp: auth.signUp,
        signOut: auth.signOut,
        getSnapshot: auth.getSnapshot
      }
    };
  }

  global.AddressBookService = {
    createAddressBookRepository,
    createMemoryDriver,
    SAMPLE_CONTACTS,
    normalizeContact,
    normalizeCompanyProfile
  };
})(window);
