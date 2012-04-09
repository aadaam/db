/*!
(C) Andrea Giammarchi, @WebReflection - Mit Style License
*/
/**@license (C) Andrea Giammarchi, @WebReflection - Mit Style License
*/
"db" in this || (function (window) {"use strict";

  // node.js exports
  if (typeof __dirname != "undefined") {
    window.create = create;
    window = global;
  } else {
    window.db = {create: create};
  }

  // exported function
  function create(name, size, callback) {
    if (callback == NULL) {
      callback = size;
      size = 1 << 20;
    }
    return new AsynchronousStorage(name, size, callback);
  }

  // utility
  function concat() {
    return "".concat.apply("", arguments);
  }

  function nothingToDoHere() {
    //^ for debug only
    console.log("[ERROR]", arguments);
    //$
  }

  var
    // fast + ad-hoc + easy polyfills
    bind                  = create.bind || function (self) {
                            var
                              callback = this,
                              args = [].slice.call(arguments, 1)
                            ;
                            return function () {
                              return callback.apply(self, args.concat.apply(args, arguments));
                            };
                          },
    indexOf               = [].indexOf || function (value) {
                            for (var i = this.length; i-- && this[i] !== value;);
                            return i;
                          },
    setTimeout            = window.setTimeout,
    // strings shortcuts
    ndexedDB              = "ndexedDB",
    openDatabase          = "openDatabase",
    executeSql            = "executeSql",
    transaction           = "transaction",
    readTransaction       = "readTransaction",
    localStorage          = "localStorage",
    prototype             = "prototype",
    unobtrusiveTableName  = "asynchronous_storage",
    keyFieldName          = "db_key",
    valueFieldName        = "db_value",
    $keys                 = "_keys",
    $length               = "length",
    $key                  = "key",
    $getItem              = "getItem",
    $setItem              = "setItem",
    $removeItem           = "removeItem",
    $clear                = "clear",
    // original IndexedDB ... unfortunately it's not usable right now as favorite choice, actually dropped later on
    indexedDB             = window["i" + ndexedDB] ||
                            window["webkitI" + ndexedDB] ||
                            window["mozI" + ndexedDB] ||
                            window["msI" + ndexedDB],
    // other shortcuts
    NULL                  = null,
    max                   = window.Math.max,
    // lazily assigned variables
    AsynchronousStorage, asPrototype,
    prepareTable, readLength, checkLength, setLength,
    prepareUpdate, checkIfPresent, clearAllItems, clearOneItem,
    onUpdateComplete, onCheckComplete, onGetComplete, onItemsCleared, onItemCleared
  ;

  // the circus ... hopefully a bloody fallback will always be available
  if (openDatabase in window) {
    AsynchronousStorage = // WebSQL version
    function AsynchronousStorage(name, size, callback) {
      this.name = name;
      this.type = "WebSQL";
      (this._db = window[openDatabase](
        name,
        "1.0",
        "",
        size
      ))[transaction](bind.call(prepareTable, this, callback));
    };

    prepareTable = function (callback, t) {
      t[executeSql](concat(
          'CREATE TABLE IF NOT EXISTS ',
            unobtrusiveTableName, ' ',
          '(',
            valueFieldName, ' TEXT NOT NULL,',
            keyFieldName, ' TEXT NOT NULL PRIMARY KEY',
          ')'
        ),
        [],
        bind.call(readLength, this, callback),
        nothingToDoHere
      );
    };

    readLength = function (callback) {
      this._db[readTransaction](
        bind.call(checkLength, this, callback)
      );
    };

    checkLength = function (callback, t) {
      t[executeSql](concat(
          'SELECT ',
            keyFieldName,
          ' AS k FROM ',
          unobtrusiveTableName
        ),
        [],
        bind.call(setLength, this, callback),
        nothingToDoHere
      );
    };

    setLength = function (callback, t, result) {
      for (var keys = this[$keys] = [], rows = result.rows, i = rows[$length]; i--; keys[i] = rows.item(i).k);
      callback.call(this, this, this[$length] = keys[$length]);
    };

    onUpdateComplete = function (key, value, callback, update) {
      if (!update) {
        this[$length] = this[$keys].push(key);
      }
      callback.call(this, value, key, this);
    };

    prepareUpdate = function (key, value, callback, errorback, update, t) {
      t[executeSql](update ?
          concat('UPDATE ', unobtrusiveTableName, ' SET ', valueFieldName, ' = ? WHERE ', keyFieldName, ' = ?') :
          concat('INSERT INTO ', unobtrusiveTableName, ' VALUES (?, ?)')
        ,
        [value, key],
        bind.call(onUpdateComplete, this, key, value, callback, update),
        errorback
      );
    };

    onCheckComplete = function (key, value, callback, errorback, t, result) {
      this._db[transaction](bind.call(
        prepareUpdate, this, key, value,
        callback, errorback,
        !!result.rows.length
      ));
    };

    checkIfPresent = function (key, value, callback, errorback, nextCallback, t) {
      t[executeSql](concat(
        'SELECT ',
          valueFieldName, ' AS v FROM ',
          unobtrusiveTableName,
        ' WHERE ', keyFieldName, ' = ?'
        ),
        [key],
        bind.call(nextCallback, this, key, value, callback, errorback),
        errorback
      );
    };

    onGetComplete = function (key, value, callback, errorback, t, result) {
      var rows = result.rows;
      callback.call(this, rows[$length] ? rows.item(0).v : value, key, this);
    };

    onItemsCleared = function (callback) {
      callback.call(this, this, this[$keys][$length] = this[$length] = 0);
    };

    clearAllItems = function (callback, errorback, t) {
      t[executeSql](concat(
        'DELETE FROM ', unobtrusiveTableName
      ), [], bind.call(onItemsCleared, this, callback), errorback);
    };

    onItemCleared = function (key, callback, t, result) {
      // be sure meanwhile nobody used db.clear()
      if (this[$length] = this[$length] - max(result.rowsAffected ? 1 : 0)) {
        var i = indexOf.call(this[$keys], key);
        if (~i) { // this should always be true ... anyway ...
          this[$keys].splice(i, 1);
        }
      } else {
        this[$keys][$length] = 0;
      }
      callback.call(this, key, this);
    };

    clearOneItem = function (key, callback, errorback, t) {
      t[executeSql](concat(
        'DELETE FROM ', unobtrusiveTableName, ' WHERE ', keyFieldName, ' = ?'
      ), [key], bind.call(onItemCleared, this, key, callback), errorback);
    };

    asPrototype = AsynchronousStorage[prototype];
    asPrototype[$key] = function key(i) {
      return this[$keys][i];
    };
    asPrototype[$removeItem] = function removeItem(key, callback, errorback) {
      this._db[transaction](bind.call(
        clearOneItem, this, key,
        callback || nothingToDoHere,
        bind.call(errorback || nothingToDoHere, this)
      ));
    };
    asPrototype[$clear] = function clear(callback, errorback) {
      this._db[transaction](bind.call(
        clearAllItems, this,
        callback || nothingToDoHere,
        bind.call(errorback || nothingToDoHere, this)
      ));
    };
    asPrototype[$getItem] = function getItem(key, callback, errorback) {
      this._db[readTransaction](bind.call(
        checkIfPresent, this, key, null,
        callback || nothingToDoHere,
        bind.call(errorback || nothingToDoHere, this),
        onGetComplete
      ));
    };
    asPrototype[$setItem] = function setItem(key, value, callback, errorback) {
      this._db[readTransaction](bind.call(
        checkIfPresent, this, key, value,
        callback || nothingToDoHere,
        bind.call(errorback || nothingToDoHere, this),
        onCheckComplete
      ));
    };
  //fuck you IndexedDB, not usable right now } else if (indexedDB) {
    //AsynchronousStorage = /*-IndexedDB:*/
  } else if (localStorage in window) {
    AsynchronousStorage = // localStorage version
    function AsynchronousStorage(name, size, callback) {
      var self = this;
      self.name = name;
      self.type = localStorage;
      self._db = window[localStorage];
      self._prefix = self.name + "\x00";
      self[$keys] = [];
      setLength.call(self);
      callback.call(self, self, self[$length]);
    };

    setLength = function () {
      for (var
        self = this,
        prefix = self._prefix,
        keys = self[$keys],
        db = self._db,
        l = 0, i = 0, length = db[$length],
        key;
        i < length; ++i
      ) {
        if (!(key = db[$key](i) || "").indexOf(prefix)) {
          keys[l++] = key;
        }
      }
      self[$length] = l;
    };

    clearOneItem = function (key, callback, errorback) {
      var
        self = this,
        keys = self[$keys],
        db_key = self._prefix + key,
        i = indexOf.call(keys, db_key)
      ;
      if (~i) {
        keys.splice(i, 1);
        self._db[$removeItem](db_key);
      }
      callback.call(self, key, self);
    };

    clearAllItems = function (callback, errorback) {
      for (var self = this, keys = self[$keys], i = 0, length = keys[$length]; i < length; ++i) {
        self._db[$removeItem](keys[i]);
      }
      callback.call(self, self, self[$length] = self[$keys][$length] = 0);
    };

    checkIfPresent = function (key, callback, errorback) {
      var self = this;
      callback.call(self, self._db[$getItem](self._prefix + key), key, self);
    };

    prepareUpdate = function (key, value, callback, errorback) {
      var
        self = this,
        db_key = self._prefix + key
      ;
      try {
        self._db[$setItem](db_key, value);
        if (!~indexOf.call(self[$keys], db_key)) {
          self[$length] = self[$keys].push(db_key);
        }
        callback.call(self, value, key, self);
      } catch(e) {
        errorback.call(self, e);
      }
    };

    readLength = function (self) {
      if (self._db[$length] < self[$keys][$length]) {
        throw "unobtrusive attempt to manipulate the localStorage";
      }
      return self;
    };

    asPrototype = AsynchronousStorage[prototype];
    asPrototype[$key] = function key(i) {
      var key = readLength(this)[$keys][i];
      return key == NULL ? key : key.slice(this._prefix[$length]);
    };
    asPrototype[$removeItem] = function removeItem(key, callback, errorback) {
      setTimeout(bind.call(clearOneItem, readLength(this), key, callback || nothingToDoHere, errorback || nothingToDoHere), 0);
    };
    asPrototype[$clear] = function clear(callback, errorback) {
      setTimeout(bind.call(clearAllItems, readLength(this), callback || nothingToDoHere, errorback || nothingToDoHere), 0);
    };
    asPrototype[$getItem] = function getItem(key, callback, errorback) {
      setTimeout(bind.call(checkIfPresent, readLength(this), key, callback || nothingToDoHere, errorback || nothingToDoHere), 0);
    };
    asPrototype[$setItem] = function setItem(key, value, callback, errorback) {
      setTimeout(bind.call(prepareUpdate, readLength(this), key, value, callback || nothingToDoHere, errorback || nothingToDoHere), 0);
    };
  } else {
    AsynchronousStorage = // cookie version ... but JC change target browsers!
function AsynchronousStorage(name) {
  this.name = name;
  this.type = "cookies";
};

asPrototype = AsynchronousStorage[prototype];
  }

}(this));