import moment from "moment";
import queue from "queue";
import {wait} from "./utils/async_utils";

function a() {
    const q = new queue({results: [], autostart: true, concurrency: 1, timeout: undefined});
    q.autostart = true;

    q.on("success", (res, job) => {
        console.log("The result is:", res);
    });

    q.push(async (cb) => {
        console.log("hello");
        console.log(moment().format("HH:mm:ss"));
        cb?.(undefined, "hello");
        return await wait(3000);
    });

    q.push(async (cb) => {
        console.log("heyA");
        console.log(moment().format("HH:mm:ss"));
        return wait(3000);
    });
}

a();
