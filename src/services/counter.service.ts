let counter = 0;

export const incrementCounter = (): number => {
    counter += 1;
    return counter;
};

export const getCounter = (): number => {
    return counter;
};

export const resetCounter = (): void => {
    counter = 0;
};