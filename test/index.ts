import * as tape from 'tape';
import {JSDOM} from 'jsdom';

import {init} from "../src";

tape('Plugin', (test) => {
    const dom = new JSDOM();
    const element = dom.window.document.createElement('div');

    Object.assign(global, {
        window: dom.window
    });

    let plugin = init(element, {
        width: 100,
        height: 100,
        frames: 10
    });

    test.true(plugin);

    plugin.setOption("duration", 5);

    test.same(plugin.getOption("duration"), 5);

    test.end();
});