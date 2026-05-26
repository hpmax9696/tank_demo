class SpatialGrid {
    constructor(cellSize = 10) {
        this.cellSize = cellSize;
        this.cells = new Map();
    }

    _getKey(x, z) {
        const cellX = Math.floor(x / this.cellSize);
        const cellZ = Math.floor(z / this.cellSize);
        return `${cellX},${cellZ}`;
    }

    _getSurroundingKeys(x, z, radius = 1) {
        const keys = [];
        const centerCellX = Math.floor(x / this.cellSize);
        const centerCellZ = Math.floor(z / this.cellSize);
        
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                keys.push(`${centerCellX + dx},${centerCellZ + dz}`);
            }
        }
        return keys;
    }

    insert(obj) {
        if (obj.x === undefined || obj.z === undefined) return;
        const key = this._getKey(obj.x, obj.z);
        if (!this.cells.has(key)) {
            this.cells.set(key, []);
        }
        this.cells.get(key).push(obj);
    }

    insertAll(objs) {
        for (const obj of objs) {
            this.insert(obj);
        }
    }

    query(x, z, radius = 1) {
        const result = new Set();
        const keys = this._getSurroundingKeys(x, z, radius);
        
        for (const key of keys) {
            const objs = this.cells.get(key);
            if (objs) {
                for (const obj of objs) {
                    const dx = obj.x - x;
                    const dz = obj.z - z;
                    if (dx * dx + dz * dz <= radius * radius * this.cellSize * this.cellSize) {
                        result.add(obj);
                    }
                }
            }
        }
        return Array.from(result);
    }

    queryByDistance(x, z, maxDist) {
        const radius = Math.ceil(maxDist / this.cellSize);
        const result = [];
        const keys = this._getSurroundingKeys(x, z, radius);
        
        for (const key of keys) {
            const objs = this.cells.get(key);
            if (objs) {
                for (const obj of objs) {
                    const dx = obj.x - x;
                    const dz = obj.z - z;
                    const distSq = dx * dx + dz * dz;
                    if (distSq <= maxDist * maxDist) {
                        result.push({ obj, distSq });
                    }
                }
            }
        }
        result.sort((a, b) => a.distSq - b.distSq);
        return result.map(item => item.obj);
    }

    clear() {
        this.cells.clear();
    }

    getStats() {
        let totalObjects = 0;
        for (const objs of this.cells.values()) {
            totalObjects += objs.length;
        }
        return {
            cells: this.cells.size,
            objects: totalObjects,
            cellSize: this.cellSize
        };
    }
}

window.SpatialGrid = SpatialGrid;