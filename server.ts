const start = async () => {
  try {
    await fastify.ready();

    console.log('================ ROUTES ================');
    console.log(fastify.printRoutes());
    console.log('========================================');

    await fastify.listen({
      port: PORT,
      host: HOST
    });

    fastify.log.info(`Servidor escutando em http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
