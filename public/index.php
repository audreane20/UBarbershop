<?php

use Slim\Factory\AppFactory;
use Slim\Views\Twig;
use Slim\Views\TwigMiddleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

require __DIR__ . '/../vendor/autoload.php';

$app = AppFactory::create();

$twig = Twig::create(__DIR__ . '/../templates', [
    'cache' => false, // Mettre un chemin (ex: '/tmp/cache') en production
]);

$app->setBasePath('/UBarbershop/public');

// Ajouter base_path à tous les templates Twig
$app->addRoutingMiddleware();

$app->add(function (Request $request, RequestHandler $handler) {
    $twig = Twig::fromRequest($request);
    $twig->getEnvironment()->addGlobal('base_path', '/UBarbershop/public');
    return $handler->handle($request);
});

$app->add(TwigMiddleware::create($app, $twig));

$app->addErrorMiddleware(true, true, true);



$app->get('/', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'index.html.twig', [
        'base_path' => '/UBarbershop/public'
    ]); 
    });
    

$app->get('/about', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'about.html.twig', [
        'base_path' => '/UBarbershop/public'
    ]); 
});

$app->get('/contact', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

     return $view->render($response, 'contact.html.twig');
});

$app->get('/login', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'login.html.twig');
});

$app->get('/appointment', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'appointment.html.twig');
});

$app->get('/callendar', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'callendar.html.twig');
});

$app->get('/register', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'register.html.twig');
});

$app->get('/admin', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'admin.html.twig');
});

$app->get('/profile', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'profile.html.twig');
});

$app->get('/services', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'services.html.twig');
});

$app->get('/unavailable', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'unavailable.html.twig');
});

$app->run();
