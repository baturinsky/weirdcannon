{
  class Cell {
    constructor(val, pattern) {
      this.val = val;
      this.pattern = pattern;
      if (val == "." || val == null)
        this.val = 0;
    }
    render([x, y], highlighted = false) {
      let hl = this.pattern == highlight || this.pattern == draggedPattern;
      return `<td id=${x}_${y} style="color:${this.pattern?.color || ""};background:${highlighted ? "#222" : this.pattern?.bgcolor(hl)}">${this.val == "_" ? " " : this.val || "."}</td>`;
    }
    clone(o) {
      let c = new Cell(this.val, this.pattern);
      if (o)
        Object.assign(c, o);
      return c;
    }
    sub(other) {
      this.val = Math.max(0, this.val - other.val);
    }
  }
  class Grid {
    constructor(o) {
      this.bits = [];
      this.at = [0, 0];
      this.findWhereFits = (pattern) => {
        for (let i = 0; i < this.len; i++) {
          let at = [~~(i / this.h), i % this.h];
          if (this.checkIfFits(pattern, at)) {
            return at;
          }
        }
        return null;
      };
      Object.assign(this, o);
      this.len = this.w * this.h;
      if (this.len)
        this.fill(0);
    }
    get color() {
      return `hsl(${this.hue} 100% 50%)`;
    }
    bgcolor(hl) {
      return `hsl(${this.hue} 100% ${hl ? 20 : 10}%)`;
    }
    clone(value, hue) {
      let g = new Grid({ w: this.w, h: this.h });
      g.bits = [];
      g.hue = hue;
      for (let i = 0; i < this.len; i++) {
        let c = this.geti(i).clone();
        if (value && c.val)
          c.val = value;
        c.pattern = g;
        g.seti(i, c);
      }
      return g;
    }
    overlap(other, at = this.at) {
      return overlap(at[0], this.w, other.at[0], other.w) && overlap(at[1], this.h, other.at[1], other.h);
    }
    hasInsideBorder(other, at = other.at) {
      let inside = at[0] + other.w <= this.w && at[1] + other.h <= this.h;
      return inside;
    }
    fromString(r) {
      let lines = r.replace(/[\t ]/g, "").trim().split("\n");
      [this.w, this.h] = [lines[0].length, lines.length];
      this.bits = lines.map((s) => [...s.trim()].map((l) => new Cell(l, this)));
      this.len = this.w * this.h;
      return this;
    }
    toString() {
      return this.bits.map((row) => row.map((v) => v.val).join("")).join("\n");
    }
    fill(v) {
      for (let i = 0; i < this.len; i++) {
        this.seti(i, new Cell(v instanceof Function ? v(i) : v, this));
      }
    }
    values() {
      return incremental(this.len).map((i) => this.toXY(i));
    }
    get(at) {
      return (this.bits[at[1]] || [])[at[0]] || zeroCell;
    }
    set(at, v) {
      this.bits[at[1]] ||= [];
      this.bits[at[1]][at[0]] = v;
    }
    geti(n) {
      return this.get(this.toXY(n));
    }
    seti(n, v) {
      this.set(this.toXY(n), v);
    }
    toXY(n) {
      return [n % this.w, ~~(n / this.w)];
    }
    apply(pattern, at, f, findTrue = false) {
      return pattern.each((v, patternAt) => {
        let gridAt = sum(patternAt, at);
        return f(this.get(gridAt), pattern.get(patternAt), gridAt, patternAt);
      }, findTrue);
    }
    checkIfFitsWithNeighbors(pattern, at) {
      return !this.apply(pattern, at, (me, p, at2, pAt) => !neighborsplus.find((delta) => pattern.get(sum(delta, pAt)).val && this.get(sum(delta, at2)).val));
    }
    _checkIfFits(pattern, at) {
      return !this.apply(pattern, at, (me, p) => (me.val || me.color) && p.val, true);
    }
    checkIfFits(pattern, at) {
      if (!this.hasInsideBorder(pattern, at))
        return false;
      for (let o of deck) {
        if (pattern.overlap(o, at))
          return false;
      }
      return true;
    }
    insert(pattern, at) {
      this.apply(pattern, at, (me, them, meAt, themAt) => this.set(meAt, them.clone()));
      pattern.at = at;
      if (this == deckBoard)
        deck.push(pattern);
    }
    sub(pattern, at) {
      this.apply(pattern, at, (me, them, meAt, themAt) => me.sub(them));
    }
    remove(pattern, at) {
      this.apply(pattern, at, (me, them, meAt, themAt) => this.set(meAt, new Cell(0, this)));
      deck = deck.filter((d) => d != pattern);
    }
    advance() {
      let overflow = 0;
      this.each((cell, at) => {
        if (at[0] == 0) {
          overflow += cell.val;
        } else {
          this.get([at[0] - 1, at[1]]).val = cell.val;
          cell.val = 0;
        }
      });
      return overflow;
    }
    each(f, findTrue = false) {
      let a = findTrue ? false : [];
      for (let i = 0; i < this.len; i++) {
        let at = this.toXY(i);
        let v = f(this.geti(i), at);
        if (findTrue) {
          if (v)
            return true;
        } else
          a.push(v);
      }
      return a;
    }
  }
  let neighbors = [[0, 1], [1, 0], [0, -1], [-1, 0]], overlap = (a, al, b, bl) => a + al > b && a < b + bl, cursorAt, deck = [], board = new Grid({ w: 24, h: 8 }), deckBoard = new Grid({ w: board.w, h: 7 }), delimiter = new Grid({ w: board.w, h: 3 }), zeroCell = new Cell(0, null), neighborsplus = [[0, 0], ...neighbors], rawPatterns, seed = ~~(Math.random() * 1e9), turn = 1, lose = false, draggingPoint, draggedPattern, highlight, patterns, maxPatterns = 20, instructions = `___________Destroy_these
________________________    
_____________Using_these`, rng = (n, pow) => {
    seed = seed * 16807 % 2147483647;
    if (pow)
      return ~~((seed % n ** pow) ** (1 / pow));
    else
      return seed % n;
  }, incremental = (n) => [...new Array(n)].map((_, i) => i), arrayOf = (n, v) => [...new Array(n)].map(() => v), renderBoard = () => {
    delimiter.insert(new Grid().fromString(`Turn_${turn}`), [0, 1]);
    if (lose) {
      delimiter.fill("_");
      delimiter.insert(new Grid().fromString(`_Game_over_in_${turn}_turns`), [0, 1]);
    }
    U.innerHTML = `<table>${incremental(board.h + delimiter.h + deckBoard.h).map((y) => [
      `<tr>`,
      ...incremental(board.w).map((x) => {
        let d = draggedCellAt([x, y]);
        let s = screenAt([x, y]);
        if (d && s && s.pattern == board && s.val > 0) {
          s = s.clone();
          s.sub(d);
          return s.render([x, y], true);
        }
        return (d || s || zeroCell)?.render([x, y], d != null || y >= board.h && y < board.h + delimiter.h);
      }),
      `</tr>`
    ]).flat().join("")}</table>`;
  }, sum = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], debounce = (callback, wait) => {
    let timeoutId = null;
    return (...args) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        callback.apply(null, args);
      }, wait);
    };
  }, processTarget = (e) => {
    let element = e.target;
    if (element?.nodeName != "TD")
      return [];
    cursorAt = element.id.split("_").map((n) => Number(n));
    let pattern;
    if (cursorAt[1] < board.h) {
      pattern = board;
    } else {
      pattern = deckBoard.get([cursorAt[0], cursorAt[1] - board.h - delimiter.h])?.pattern;
    }
    return [cursorAt, pattern];
  }, screenAt = ([x, y]) => {
    return y < board.h ? board.get([x, y]) : y < board.h + delimiter.h ? delimiter.get([x, y - board.h]) : deckBoard.get([x, y - board.h - delimiter.h]);
  }, draggedCellAt = (at) => {
    if (!draggedPattern || !cursorAt)
      return;
    let cell = draggedPattern.get(sub(sum(at, draggingPoint), cursorAt));
    return cell.val ? cell : null;
  }, deckCoord = (at) => [at[0], at[1] - board.h - delimiter.h], givePatterns = (n = 1) => {
    let count = 0;
    for (let i = 0; i < n; i++) {
      let ind = patterns.length - 1 - ~~rng(patterns.length, 2);
      let pattern = patterns[ind];
      let where = deckBoard.findWhereFits(pattern);
      let val = 3 - ~~rng(3, 2);
      if (where) {
        let p = pattern.clone(val, where[0] * 30 + where[1] * 43 + patterns.length * 27);
        p.pattern = true;
        deckBoard.insert(p, where);
        count++;
      }
    }
    return count;
  }, placeEnemies = (n) => {
    for (let i = 0; i < n; i++) {
      let at = [board.w - 10 + rng(10, 3), rng(board.h)];
      let cell = board.get(at);
      cell.val++;
    }
  }, main = () => {
    patterns = rawPatterns.map((r) => new Grid().fromString(r));
    givePatterns(maxPatterns);
    board.fill(0);
    placeEnemies(30);
    delimiter.fromString(instructions);
    let U2 = document.getElementById("U");
    U2.onmousemove = (e) => {
      let oldHighlight = highlight, oldAt = cursorAt;
      let [at, grid] = processTarget(e);
      highlight = null;
      if (grid) {
        cursorAt = at;
        if (!draggedPattern && grid.pattern)
          highlight = grid;
        if (highlight != oldHighlight || draggedPattern && oldAt != cursorAt)
          debounce(renderBoard, 100)();
      }
    };
    U2.onmousedown = (e) => {
      if (lose)
        return;
      let [at, grid] = processTarget(e);
      if (draggedPattern) {
        if (grid == deckBoard) {
          at = sub(deckCoord(at), draggingPoint);
          if (deckBoard.checkIfFits(draggedPattern, at)) {
            deckBoard.insert(draggedPattern, at);
            draggedPattern = null;
          }
        } else if (grid == board) {
          at = sub(at, draggingPoint);
          board.sub(draggedPattern, at);
          draggedPattern = null;
          let overflow = board.advance();
          if (overflow)
            lose = true;
          deck = deck.filter((p) => p != draggedPattern);
          let tries = 10;
          while (tries-- > 0 && deck.length < maxPatterns)
            givePatterns();
          placeEnemies(4 + ~~(turn / 10));
          turn++;
        }
      } else if (grid instanceof Grid && grid.pattern) {
        draggedPattern = grid;
        draggingPoint = sub(deckCoord(at), grid.at);
        deckBoard.remove(grid, grid.at);
        highlight = null;
      }
      renderBoard();
    };
    renderBoard();
  };
  rawPatterns = [
    `
###
`,
    `
#
#
#
`,
    `
##
##
`,
    `
###
###
###
`,
    `
#####
`,
    `
#
#
#
#
#
`,
    `
#.#
.#.
#.#
`,
    `
.#.
###
.#.
`,
    `
#####
#####
#####
#####
#####
`,
    `
..#..
..#..
#####
..#..
..#..
`,
    `
#.#.#
.#.#.
#.#.#
.#.#.
#.#.#
`,
    `
#.#
#.#
#.#
`,
    `
###
...
###
`
  ];
  main();
}
