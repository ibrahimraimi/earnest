export const serializeNonPOJOs = (obj: unknown) => {
	return structuredClone(obj);
};
