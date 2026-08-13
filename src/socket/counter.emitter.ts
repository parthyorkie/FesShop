import { Server } from "socket.io";
import { logger } from "../utils/logger";

import { incrementCounter } from "../services/counter.service";
import { COUNTER_EVENTS } from "./counter.events";
import { CounterPayload } from "./counter.types";

let timer: NodeJS.Timeout | null = null;

export const startCounterEmitter = (
    io: Server
): void => {

    if (timer) {
        return;
    }

    timer = setInterval(() => {

        const value = incrementCounter();

        const payload: CounterPayload = {
            value,
        };

        logger.info(
            `Counter : ${value}`
        );

        io.emit(
            COUNTER_EVENTS.UPDATE,
            payload
        );

    }, 2000);

};