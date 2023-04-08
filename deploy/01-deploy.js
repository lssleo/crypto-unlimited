const { network } = require('hardhat')
const { developmentChains } = require('../helper-hardhat-config')
const { verify } = require('../utils/verify')

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    const basicNFt =
        ''
    const rareNft =
        ''
    const superRareNft =
        ''

    const salesSbt =
        ''
    const rareSbt =
        ''
    const superSbt =
        ''
    const VRFCoordinator = '' //mumbai

    log('=====================================================================')
    const ControlArgs = [deployer, deployer, deployer, deployer]
    const Control = await deploy('Control', {
        from: deployer,
        args: ControlArgs,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    const RegistryArgs = []
    const Registry = await deploy('Registry', {
        from: deployer,
        args: RegistryArgs,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    const HolderArgs = [[deployer], ['100']]
    const Holder = await deploy('Holder', {
        from: deployer,
        args: HolderArgs,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    const MarketplaceArgs = [Control.address, Registry.address]
    const Marketplace = await deploy('Marketplace', {
        from: deployer,
        args: MarketplaceArgs,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    const MinterArgs = [Control.address, Registry.address]
    const Minter = await deploy('Minter', {
        from: deployer,
        args: MinterArgs,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    const RandomArgs = [Registry.address, VRFCoordinator, [superRareNft, rareNft, basicNFt]]
    const Random = await deploy('Random', {
        from: deployer,
        args: RandomArgs,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    const SoulboundsArgs = [Control.address, Registry.address, salesSbt, rareSbt, superSbt]
    const Soulbounds = await deploy('Soulbounds', {
        from: deployer,
        args: SoulboundsArgs,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (!developmentChains.includes(network.name) && process.env.POLYGONSCAN_API_KEY) {
        log('verifying...')
        await verify(Control.address, ControlArgs)
        log('=======================================================================')
        await verify(Registry.address, RegistryArgs)
        log('=======================================================================')
        await verify(Holder.address, HolderArgs)
        log('=======================================================================')
        await verify(Marketplace.address, MarketplaceArgs)
        log('=======================================================================')
        await verify(Minter.address, MinterArgs)
        log('=======================================================================')
        await verify(Random.address, RandomArgs)
        log('=======================================================================')
        await verify(Soulbounds.address, SoulboundsArgs)
    }
}
module.exports.tags = ['all', 'main']
