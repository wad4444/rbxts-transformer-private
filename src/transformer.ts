import ts from "typescript";

export interface TransformerConfig {
	includeInternal?: boolean;
	customPrefix?: string;
}

export class TransformContext {
	public factory: ts.NodeFactory;

	constructor(
		public program: ts.Program,
		public context: ts.TransformationContext,
		public config: TransformerConfig,
	) {
		this.factory = context.factory;
	}

	transform<T extends ts.Node>(node: T): T {
		return ts.visitEachChild(
			node,
			(node) => visitNode(this, node),
			this.context,
		);
	}
}

function isPrivate(
	context: TransformContext,
	node: ts.PropertyDeclaration | ts.MethodDeclaration,
) {
	if (context.config.includeInternal && node.jsDoc) {
		for (const jsDoc of node.jsDoc) {
			if (!jsDoc.tags) continue;
			for (const tag of jsDoc.tags) {
				if (tag.tagName.escapedText === "internal") return true;
			}
		}
	}

	return (
		node.modifiers?.find(
			(modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword,
		) !== undefined
	);
}

function getPrefix(context: TransformContext) {
	return context.config.customPrefix ?? "_";
}

function visitPropertyDeclaration(
	context: TransformContext,
	node: ts.PropertyDeclaration,
) {
	if (!isPrivate(context, node)) return context.transform(node);

	const { factory } = context;
	return factory.updatePropertyDeclaration(
		node,
		node.modifiers?.map((T) => context.transform(T)),
		factory.createIdentifier(`${getPrefix(context)}${node.name.getText()}`),
		node.questionToken || node.exclamationToken,
		node.type ? context.transform(node.type) : undefined,
		node.initializer ? context.transform(node.initializer) : undefined,
	);
}

function visitMethodDeclaration(
	context: TransformContext,
	node: ts.MethodDeclaration,
) {
	if (!isPrivate(context, node)) return context.transform(node);

	const { factory } = context;
	return factory.updateMethodDeclaration(
		node,
		node.modifiers?.map((T) => context.transform(T)),
		node.asteriskToken,
		factory.createIdentifier(`${getPrefix(context)}${node.name.getText()}`),
		node.questionToken,
		node.typeParameters?.map((T) => context.transform(T)),
		node.parameters.map((T) => context.transform(T)),
		node.type ? context.transform(node.type) : undefined,
		node.body ? context.transform(node.body) : undefined,
	);
}

function visitPropertyAccessExpression(
	context: TransformContext,
	node: ts.PropertyAccessExpression,
) {
	const { factory, program } = context;
	const symbol = program.getTypeChecker().getSymbolAtLocation(node);
	if (!symbol?.declarations) return context.transform(node);

	for (const declaration of symbol.declarations) {
		if (
			ts.isPropertyDeclaration(declaration) ||
			ts.isMethodDeclaration(declaration)
		) {
			if (!isPrivate(context, declaration)) continue;
			return factory.updatePropertyAccessExpression(
				node,
				context.transform(node.expression),
				ts.factory.createIdentifier(
					`${getPrefix(context)}${node.name.getText()}`,
				),
			);
		}
	}

	return context.transform(node);
}

function visitNode(
	context: TransformContext,
	node: ts.Node,
): ts.Node | ts.Node[] {
	if (ts.isPropertyDeclaration(node)) {
		return visitPropertyDeclaration(context, node);
	}
	if (ts.isMethodDeclaration(node)) {
		return visitMethodDeclaration(context, node);
	}
	if (ts.isPropertyAccessExpression(node)) {
		return visitPropertyAccessExpression(context, node);
	}

	return context.transform(node);
}
