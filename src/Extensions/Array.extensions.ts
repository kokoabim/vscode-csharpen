declare global {
    interface Array<T> {
        anyMatches(regexp: string | RegExp): boolean;
        count(predicate: (item: T) => boolean): number;
        groupBy<K extends keyof T>(key: K): Map<T[K], T[]>;
        sortBy<K extends keyof T>(key: K): T[];
        sortReverseBy<K extends keyof T>(key: K): T[];
    }
}

Array.prototype.anyMatches = function (regexp: string | RegExp): boolean {
    const regex = regexp instanceof RegExp ? regexp : new RegExp(regexp);
    return this.some(item => regex.test(item.toString()));
};

Array.prototype.count = function <T>(predicate: (item: T) => boolean): number {
    return this.reduce((count, item) => {
        if (predicate(item)) count++;
        return count;
    }, 0);
};

Array.prototype.groupBy = function <T, K extends keyof T>(key: K): Map<T[K], T[]> {
    return this.reduce((map, item) => {
        const keyValue = item[key];
        const group = map.get(keyValue);
        if (group) {
            group.push(item);
        } else {
            map.set(keyValue, [item]);
        }
        return map;
    }, new Map<T[K], T[]>());
};

Array.prototype.sortBy = function <T, K extends keyof T>(key: K): T[] {
    return this.sort((a, b) => {
        if (a[key] < b[key]) return -1;
        if (a[key] > b[key]) return 1;
        return 0;
    });
};

Array.prototype.sortReverseBy = function <T, K extends keyof T>(key: K): T[] {
    return this.sort((a, b) => {
        if (a[key] < b[key]) return 1;
        if (a[key] > b[key]) return -1;
        return 0;
    });
};

export { };
