<?php

use Slim\Factory\AppFactory;
use Slim\Views\Twig;
use Slim\Views\TwigMiddleware;

require __DIR__ . '/../vendor/autoload.php';

$app = AppFactory::create();

$twig = Twig::create(__DIR__ . '/../templates', [
    'cache' => false, // Mettre un chemin (ex: '/tmp/cache') en production
]);

$app->add(TwigMiddleware::create($app, $twig));

$app->setBasePath('/UBarbershop/public');

$app->addErrorMiddleware(true, true, true);

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

$app->get('/', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'index.html.twig'); 
    });
    


$app->run();
